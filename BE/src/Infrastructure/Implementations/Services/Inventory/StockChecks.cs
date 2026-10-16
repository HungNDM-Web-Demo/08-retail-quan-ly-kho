using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.Documents;
using Domain.Entities.Inventory.Stock;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Kiểm tồn khả dụng khi gửi duyệt (BR-04) và tồn thực khi duyệt (UC-05 E2), dùng cho phiếu xuất và phiếu chuyển.</summary>
internal static class StockChecks
{
    /// <summary>07 §3.6: Σ baseQuantity theo mặt hàng ≤ khả dụng; lỗi gắn vào mọi dòng của mặt hàng vượt.</summary>
    public static async Task EnsureAvailableAsync(
        IStockQueries queries,
        IStockPostingService posting,
        Guid warehouseId,
        IReadOnlyList<DocLine> lines,
        CancellationToken ct)
    {
        var productIds = lines.Select(l => l.ProductId).Distinct().ToList();
        var reserved = await queries.ReservedAsync(warehouseId, productIds, ct);
        var book = await posting.LoadBookAsync(productIds.Select(p => (warehouseId, p)), ct);

        var errors = new Dictionary<string, string[]>();
        var details = new List<object>();
        string? firstMessage = null;
        foreach (var group in lines.GroupBy(l => l.ProductId))
        {
            var requested = group.Sum(l => l.BaseQuantity);
            var available = (book.Find(warehouseId, group.Key)?.OnHand ?? 0) - reserved.GetValueOrDefault(group.Key);
            if (requested <= available)
                continue;

            var excess = requested - Math.Max(available, 0);
            var message = InventoryErrors.OverAvailable(excess, group.First().BaseUnit);
            firstMessage ??= message;
            foreach (var line in group)
            {
                var index = line.LineNo - 1;
                errors[$"lines[{index}].quantity"] = [message];
                details.Add(new { index, productId = group.Key, requested, available, excess });
            }
        }

        if (errors.Count == 0)
            return;

        var detail = errors.Count == 1 ? firstMessage! : InventoryErrors.OverAvailableLines(errors.Count);
        throw InventoryErrors.WithErrors(InventoryErrors.VuotTonKhaDung, detail, errors,
            new Dictionary<string, object?> { ["lines"] = details });
    }

    /// <summary>UC-05 E2: Σ baseQuantity theo mặt hàng ≤ tồn thực.</summary>
    public static void EnsureOnHand(StockBook book, Guid warehouseId, IReadOnlyList<DocLine> lines)
    {
        var shortages = new List<object>();
        string? message = null;
        foreach (var group in lines.OrderBy(l => l.LineNo).GroupBy(l => l.ProductId))
        {
            var required = group.Sum(l => l.BaseQuantity);
            var onHand = book.Find(warehouseId, group.Key)?.OnHand ?? 0;
            if (required <= onHand)
                continue;
            var first = group.First();
            message ??= InventoryErrors.NotEnoughOnHand(first.ProductName, required - onHand, first.BaseUnit);
            shortages.Add(new { productId = group.Key, productName = first.ProductName, required, onHand, missing = required - onHand });
        }

        if (message is not null)
        {
            throw InventoryErrors.Business(InventoryErrors.KhongDuTonThuc, message,
                new Dictionary<string, object?> { ["shortages"] = shortages });
        }
    }

    /// <summary>Số liệu cho người duyệt (UC-05 bước 2) theo từng dòng.</summary>
    public static Dictionary<Guid, Application.DTOs.Inventory.ApprovalPreview> Previews(
        StockBook book, Guid warehouseId, IReadOnlyList<DocLine> lines, bool canViewValues)
    {
        var totals = lines.GroupBy(l => l.ProductId).ToDictionary(g => g.Key, g => g.Sum(l => l.BaseQuantity));
        return lines.ToDictionary(l => l.Id, l =>
        {
            var level = book.Find(warehouseId, l.ProductId);
            var onHand = level?.OnHand ?? 0;
            decimal? cost = canViewValues ? level?.AvgCost ?? 0 : null;
            decimal? estimate = canViewValues
                ? (level is not null && l.BaseQuantity == level.OnHand ? level.StockValue : l.BaseQuantity * (level?.AvgCost ?? 0))
                : null;
            return new Application.DTOs.Inventory.ApprovalPreview(onHand, Math.Max(0, totals[l.ProductId] - onHand), cost, estimate);
        });
    }
}
