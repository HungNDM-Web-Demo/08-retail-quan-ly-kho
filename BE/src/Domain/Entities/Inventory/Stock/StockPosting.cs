using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Transfers;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory.Stock;

/// <summary>
/// Ghi sổ một chứng từ vào <see cref="StockBook"/> đúng thứ tự 07 §3.3–3.7, từng dòng theo <c>LineNo</c> (BR-09…BR-13, BR-17).
/// Đổi dòng tồn, ghi giá vốn và giá trị vào dòng phiếu, trả các dòng thẻ kho cần thêm. Nơi duy nhất đổi tồn (BR-11);
/// gọi qua <c>IStockPostingService</c> khi duyệt và khi nạp dữ liệu mẫu.
/// </summary>
public static class StockPosting
{
    /// <summary>Tính thành tiền, chi phí phân bổ (BR-08), giá trị nhập kho và tổng phiếu nhập.</summary>
    public static void RecalculateReceipt(GoodsReceipt doc)
    {
        var lines = doc.Lines.OrderBy(l => l.LineNo).ToList();
        foreach (var line in lines)
            line.Amount = line.Quantity * line.UnitPrice;

        var allocated = StockMath.AllocateFreight(
            lines.Select(l => l.Amount).ToList(), lines.Select(l => l.BaseQuantity).ToList(), doc.FreightCost);
        for (var i = 0; i < lines.Count; i++)
        {
            lines[i].AllocatedCost = allocated[i];
            lines[i].Value = lines[i].Amount + allocated[i];
        }

        doc.TotalAmount = lines.Sum(l => l.Amount);
        doc.TotalValue = lines.Sum(l => l.Value);
    }

    public static List<StockLedgerEntry> Receipt(StockBook book, GoodsReceipt doc, DateTime at, string description)
    {
        RecalculateReceipt(doc);
        var entries = new List<StockLedgerEntry>();
        foreach (var line in doc.Lines.OrderBy(l => l.LineNo))
        {
            var level = book.Get(doc.WarehouseId, line.ProductId);
            In(level, line.BaseQuantity, line.Value, at);
            entries.Add(Entry(level, at, line.LineNo, LedgerDocType.PhieuNhap, doc.Id, doc.Code, line.Id, (int)doc.Type, null,
                description, line.BaseQuantity, 0, StockMath.RoundDiv(line.Value, line.BaseQuantity), line.Value, 0));
        }

        return entries;
    }

    public static List<StockLedgerEntry> Issue(StockBook book, GoodsIssue doc, DateTime at, string description)
    {
        var countsAsIssue = doc.Type is IssueType.XuatBan or IssueType.DungNoiBo;
        var entries = new List<StockLedgerEntry>();
        foreach (var line in doc.Lines.OrderBy(l => l.LineNo))
        {
            var level = book.Get(doc.WarehouseId, line.ProductId);
            var cost = level.AvgCost;
            var value = Out(level, line.BaseQuantity, at, countsAsIssue);
            line.UnitCost = cost;
            line.Value = value;
            entries.Add(Entry(level, at, line.LineNo, LedgerDocType.PhieuXuat, doc.Id, doc.Code, line.Id, (int)doc.Type, null,
                description, 0, line.BaseQuantity, cost, 0, value));
        }

        doc.TotalValue = doc.Lines.Sum(l => l.Value ?? 0);
        return entries;
    }

    /// <summary>Duyệt phiếu chuyển: xuất khỏi kho đi theo BR-10, ghi giá vốn chuyển (BR-13).</summary>
    public static List<StockLedgerEntry> TransferOut(StockBook book, Transfer doc, DateTime at, string description)
    {
        var entries = new List<StockLedgerEntry>();
        foreach (var line in doc.Lines.OrderBy(l => l.LineNo))
        {
            var level = book.Get(doc.FromWarehouseId, line.ProductId);
            var cost = level.AvgCost;
            var value = Out(level, line.BaseQuantity, at, countsAsIssue: true);
            line.UnitCost = cost;
            line.Value = value;
            entries.Add(Entry(level, at, line.LineNo, LedgerDocType.ChuyenDi, doc.Id, doc.Code, line.Id, null, doc.ToWarehouseId,
                description, 0, line.BaseQuantity, cost, 0, value));
        }

        doc.TotalValue = doc.Lines.Sum(l => l.Value ?? 0);
        return entries;
    }

    /// <summary>Nhận hàng chuyển: cộng số thực nhận × giá vốn chuyển vào kho đến (BR-09); hao hụt không vào thẻ kho.</summary>
    public static List<StockLedgerEntry> TransferIn(StockBook book, Transfer doc, DateTime at, string description)
    {
        var entries = new List<StockLedgerEntry>();
        foreach (var line in doc.Lines.OrderBy(l => l.LineNo))
        {
            var received = line.ReceivedBaseQuantity ?? line.BaseQuantity;
            var cost = line.UnitCost ?? 0;
            line.ReceivedBaseQuantity = received;
            line.ShortageQuantity = line.BaseQuantity - received;
            line.ShortageValue = line.ShortageQuantity * cost;
            if (received <= 0)
                continue;

            var value = received * cost;
            var level = book.Get(doc.ToWarehouseId, line.ProductId);
            In(level, received, value, at);
            var text = line.ShortageQuantity > 0
                ? $"{description} (thiếu {InventoryRules.Number(line.ShortageQuantity.Value)} {line.BaseUnit.ToLowerInvariant()})"
                : description;
            entries.Add(Entry(level, at, line.LineNo, LedgerDocType.ChuyenDen, doc.Id, doc.Code, line.Id, null, doc.FromWarehouseId,
                text, received, 0, cost, value, 0));
        }

        doc.ShortageValue = doc.Lines.Sum(l => l.ShortageValue ?? 0);
        return entries;
    }

    /// <summary>Duyệt kiểm kê (BR-17): dòng chênh ≠ 0 theo <c>SortOrder</c>, giá vốn giữ nguyên.</summary>
    public static List<StockLedgerEntry> Stocktake(StockBook book, Stocktake doc, DateTime at)
    {
        var entries = new List<StockLedgerEntry>();
        var seq = 0;
        foreach (var line in doc.Lines.OrderBy(l => l.SortOrder).ThenBy(l => l.ProductCode, StringComparer.Ordinal))
        {
            seq++;
            var difference = (line.CountedQuantity ?? line.BookQuantity) - line.BookQuantity;
            if (difference == 0)
                continue;

            var level = book.Get(doc.WarehouseId, line.ProductId);
            var value = StockMath.AdjustValue(level.OnHand, level.StockValue, difference, line.BookCost);
            if (difference > 0)
            {
                level.OnHand += difference;
                level.StockValue += value;
                level.FirstReceiptAt ??= at;
            }
            else
            {
                if (level.OnHand + difference < 0)
                    throw new InvalidOperationException($"Kiểm kê làm âm tồn {line.ProductCode}.");
                level.OnHand += difference;
                level.StockValue -= value;
            }

            if (level.OnHand == 0)
                level.StockValue = 0;
            level.Version++;
            var reason = line.Reason is { } r ? InventoryRules.Label(r) : "Chênh lệch kiểm kê";
            entries.Add(Entry(level, at, seq, LedgerDocType.KiemKe, doc.Id, doc.Code, line.Id, null, null,
                $"Điều chỉnh kiểm kê {doc.Code} – {reason}",
                Math.Max(difference, 0), Math.Max(-difference, 0), line.BookCost,
                difference > 0 ? value : 0, difference < 0 ? value : 0));
        }

        return entries;
    }

    private static void In(StockLevel level, int q, decimal value, DateTime at)
    {
        level.AvgCost = StockMath.AvgCostAfterIn(level.OnHand, level.StockValue, q, value);
        level.StockValue += value;
        level.OnHand += q;
        level.FirstReceiptAt ??= at;
        level.Version++;
    }

    private static decimal Out(StockLevel level, int q, DateTime at, bool countsAsIssue)
    {
        if (q > level.OnHand)
            throw new InvalidOperationException($"Không đủ tồn để ghi sổ: cần {q}, còn {level.OnHand}.");
        var value = StockMath.OutValue(level.OnHand, level.StockValue, level.AvgCost, q);
        level.StockValue -= value;
        level.OnHand -= q;
        if (level.OnHand == 0)
            level.StockValue = 0;
        if (countsAsIssue)
            level.LastIssueAt = at;
        level.Version++;
        return value;
    }

    private static StockLedgerEntry Entry(
        StockLevel level, DateTime at, long seq, LedgerDocType type, Guid docId, string? docCode, Guid lineId, int? subType,
        Guid? counterpart, string description, int inQty, int outQty, decimal unitCost, decimal inValue, decimal outValue)
    {
        var entry = new StockLedgerEntry
        {
            WarehouseId = level.WarehouseId,
            ProductId = level.ProductId,
            PostedAt = at,
            Seq = seq,
            DocType = type,
            DocId = docId,
            DocCode = docCode ?? string.Empty,
            DocLineId = lineId,
            SubType = subType,
            CounterpartWarehouseId = counterpart,
            Description = description.Length > 300 ? description[..300] : description,
            InQuantity = inQty,
            OutQuantity = outQty,
            BalanceQuantity = level.OnHand,
            UnitCost = unitCost,
            InValue = inValue,
            OutValue = outValue,
            BalanceValue = level.StockValue,
            AvgCostAfter = level.AvgCost
        };
        entry.SetCreatedAt(at);
        return entry;
    }
}
