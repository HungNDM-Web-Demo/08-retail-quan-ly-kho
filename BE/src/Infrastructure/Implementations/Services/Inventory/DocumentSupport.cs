using Application.Common.Exceptions;
using Application.Common.Time;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.Documents;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Inventory.Warehouses;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Gom lỗi theo trường rồi ném một <see cref="ValidationException"/> (400 kèm <c>errors</c>).</summary>
internal sealed class FieldErrorBag
{
    private readonly List<ValidationFailure> _failures = [];

    public bool Any => _failures.Count > 0;

    public void Add(string field, string message) => _failures.Add(new ValidationFailure(field, message));

    public Dictionary<string, string[]> ToDictionary() =>
        _failures.GroupBy(f => f.PropertyName).ToDictionary(g => g.Key, g => g.Select(f => f.ErrorMessage).Distinct().ToArray());

    public void ThrowIfAny()
    {
        if (_failures.Count > 0)
            throw new ValidationException(_failures);
    }
}

/// <summary>Dòng đã kiểm, sẵn để ghi vào dòng phiếu.</summary>
internal sealed record ResolvedLine(int Index, Product Product, ProductUnit? Unit, int Quantity)
{
    public int Factor => Unit?.Factor ?? 1;

    public int BaseQuantity => StockMath.ToBase(Quantity, Factor);

    public void FillTo(DocLine line, int lineNo)
    {
        line.LineNo = lineNo;
        line.ProductId = Product.Id;
        line.ProductCode = Product.Code;
        line.ProductName = Product.Name;
        line.BaseUnit = Product.BaseUnit;
        line.UnitId = Unit?.Id;
        line.UnitName = Unit?.Name ?? Product.BaseUnit;
        line.Factor = Factor;
        line.Quantity = Quantity;
        line.BaseQuantity = BaseQuantity;
    }
}

/// <summary>Quy tắc dùng chung của phiếu nhập, xuất, chuyển (07 §2.4–2.6, §3.8).</summary>
internal static class DocumentSupport
{
    public const string PhoneMessage = "Số điện thoại gồm 10–11 số, bắt đầu bằng 0";

    /// <summary>Số điện thoại 10–11 số bắt đầu bằng 0, cho phép khoảng trắng, dấu chấm, gạch ngang (như nền).</summary>
    public static bool IsPhone(string value)
    {
        var digits = new string(value.Where(c => c is not (' ' or '.' or '-')).ToArray());
        return digits.Length is 10 or 11 && digits[0] == '0' && digits.All(char.IsAsciiDigit);
    }

    public const string LinesRequired = "Phiếu phải có ít nhất 1 dòng";
    public static readonly string LinesTooMany = $"Phiếu tối đa {InventoryRules.MaxLines} dòng, hãy tách phiếu";

    /// <summary>Kiểm dòng (mặt hàng đang sử dụng, đơn vị thuộc mặt hàng, số lượng nguyên &gt; 0, tối đa 200 dòng).</summary>
    public static async Task<List<ResolvedLine>> ResolveLinesAsync(
        IGenericRepository<Product> products,
        IReadOnlyList<DocLineInput> inputs,
        bool requireAtLeastOne,
        FieldErrorBag errors,
        CancellationToken ct)
    {
        if (inputs.Count > InventoryRules.MaxLines)
            errors.Add("lines", LinesTooMany);
        else if (inputs.Count == 0 && requireAtLeastOne)
            errors.Add("lines", LinesRequired);

        var ids = inputs.Select(i => i.ProductId).Distinct().ToList();
        var found = await products.QueryNoTracking().Include(p => p.Units)
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var result = new List<ResolvedLine>();
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            if (!found.TryGetValue(input.ProductId, out var product))
            {
                errors.Add($"lines[{i}].productId", "Mặt hàng không tồn tại");
                continue;
            }

            if (!product.IsActive)
                errors.Add($"lines[{i}].productId", $"{product.Name} đã ngừng sử dụng");

            ProductUnit? unit = null;
            if (input.UnitId is { } unitId)
            {
                unit = product.Units.FirstOrDefault(u => u.Id == unitId);
                if (unit is null)
                    errors.Add($"lines[{i}].unitId", "Đơn vị không thuộc mặt hàng");
            }

            if (input.Quantity <= 0)
                errors.Add($"lines[{i}].quantity", "Số lượng phải là số nguyên lớn hơn 0");

            result.Add(new ResolvedLine(i, product, unit, input.Quantity));
        }

        return result;
    }

    public static async Task<Warehouse> RequireWarehouseAsync(
        IGenericRepository<Warehouse> warehouses, Guid id, InventoryActor actor, string field, FieldErrorBag errors, CancellationToken ct)
    {
        var warehouse = await warehouses.QueryNoTracking().FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new ValidationException([new ValidationFailure(field, "Chọn kho")]);
        if (!actor.InScope(warehouse.Id))
            throw InventoryProblems.NotKeeper(warehouse.Code);
        if (!warehouse.IsActive)
            errors.Add(field, $"Kho {warehouse.Code} đã ngừng hoạt động");
        return warehouse;
    }

    public static void EnsureScope(InventoryActor actor, Guid warehouseId, IReadOnlyDictionary<Guid, Warehouse> names)
    {
        if (!actor.InScope(warehouseId))
            throw InventoryProblems.NotKeeper(names.TryGetValue(warehouseId, out var w) ? w.Code : string.Empty);
    }

    /// <summary>07 §3.8 bước 2: phiếu đã ghi sổ → 409 <c>PhieuDaDuyet</c>, sai trạng thái khác → 400 <c>TrangThaiKhongHopLe</c>.</summary>
    public static void EnsureStatus(bool allowed, bool posted, InventoryDocument doc, string statusLabel, string statusName)
    {
        if (allowed)
            return;
        if (posted)
            throw InventoryProblems.AlreadyApproved(doc.Code, doc.ApprovedByName, doc.ApprovedAt);
        throw InventoryErrors.Business(InventoryErrors.TrangThaiKhongHopLe, InventoryErrors.InvalidStatus(statusLabel),
            new Dictionary<string, object?> { ["docStatus"] = statusName });
    }

    public static void EnsureCreator(InventoryDocument doc, InventoryActor actor)
    {
        if (doc.CreatedBy != actor.UserId)
            throw InventoryErrors.Business(InventoryErrors.KhongPhaiNguoiLap, InventoryErrors.NotCreatorMessage);
    }

    /// <summary>BR-06: người duyệt khác người lập.</summary>
    public static void EnsureNotCreator(InventoryDocument doc, InventoryActor actor)
    {
        if (doc.CreatedBy == actor.UserId)
            throw InventoryErrors.Business(InventoryErrors.NguoiDuyetTrungNguoiLap, InventoryErrors.SameApproverMessage);
    }

    public static void EnsureVersion(int current, int? requested)
    {
        if (requested != current)
            throw InventoryProblems.Stale(current);
    }

    public static string RequireRejectReason(string? reason)
    {
        var trimmed = reason?.Trim() ?? string.Empty;
        if (trimmed.Length < InventoryRules.MinRejectReason)
            throw new ValidationException([new ValidationFailure("reason", "Lý do từ chối tối thiểu 10 ký tự")]);
        return trimmed;
    }

    public static void Touch(InventoryDocument doc, string? requestId)
    {
        doc.LastRequestId = Limit(requestId, 64);
        doc.Version++;
    }

    public static string? Limit(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }

    public static void RequireClientRequestId(string? clientRequestId)
    {
        if (string.IsNullOrWhiteSpace(clientRequestId) || clientRequestId.Length > 64)
            throw new ValidationException([new ValidationFailure("clientRequestId", "Thiếu mã yêu cầu (clientRequestId)")]);
    }

    public static async Task<Dictionary<Guid, Warehouse>> WarehousesAsync(IGenericRepository<Warehouse> warehouses, CancellationToken ct) =>
        await warehouses.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(w => w.Id, ct);

    public static async Task<Dictionary<Guid, Supplier>> SuppliersAsync(IGenericRepository<Supplier> suppliers, CancellationToken ct) =>
        await suppliers.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(s => s.Id, ct);

    /// <summary>Khoảng ngày giờ Việt Nam → [UTC đầu ngày from, UTC đầu ngày sau to) (07 §2 quy ước).</summary>
    public static (DateTime FromUtc, DateTime ToUtcExclusive, DateOnly From, DateOnly To)? ParseRange(string? from, string? to, bool required)
    {
        var hasFrom = !string.IsNullOrWhiteSpace(from);
        var hasTo = !string.IsNullOrWhiteSpace(to);
        if (!hasFrom && !hasTo)
        {
            if (required)
                throw new ValidationException([new ValidationFailure("from", "Chọn khoảng ngày")]);
            return null;
        }

        var errors = new FieldErrorBag();
        DateOnly fromDate = default, toDate = default;
        if (hasFrom && !VietnamDates.TryParse(from, out fromDate))
            errors.Add("from", "Ngày không hợp lệ (yyyy-MM-dd)");
        if (hasTo && !VietnamDates.TryParse(to, out toDate))
            errors.Add("to", "Ngày không hợp lệ (yyyy-MM-dd)");
        if (required && (!hasFrom || !hasTo))
            errors.Add(hasFrom ? "to" : "from", "Chọn khoảng ngày");
        errors.ThrowIfAny();

        if (!hasFrom)
            fromDate = DateOnly.MinValue.AddYears(2000);
        if (!hasTo)
            toDate = DateOnly.MaxValue.AddYears(-1000);
        if (hasFrom && hasTo)
        {
            if (toDate < fromDate)
                throw new ValidationException([new ValidationFailure("to", "Ngày kết thúc phải sau ngày bắt đầu")]);
            if (toDate.DayNumber - fromDate.DayNumber + 1 > InventoryRules.MaxRangeDays)
                throw new ValidationException([new ValidationFailure("from", $"Khoảng ngày tối đa {InventoryRules.MaxRangeDays} ngày")]);
        }

        return (VietnamDates.StartOfDayUtc(fromDate), VietnamDates.EndOfDayExclusiveUtc(toDate), fromDate, toDate);
    }

    /// <summary>Diễn giải thẻ kho của phiếu nhập (07 §3.10).</summary>
    public static string ReceiptDescription(Domain.Entities.Inventory.GoodsReceipts.GoodsReceipt doc, string? supplierName, string? originalCode)
    {
        if (doc.Type == Domain.Enums.Inventory.ReceiptType.NhapDieuChinh)
            return $"Nhập điều chỉnh – phiếu ngược của {originalCode}";
        var detail = new[] { supplierName, doc.DelivererName, doc.Note }.FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
        var label = InventoryRules.Label(doc.Type);
        return detail is null ? label : $"{label} – {detail}";
    }

    /// <summary>Diễn giải thẻ kho của phiếu xuất (07 §3.10).</summary>
    public static string IssueDescription(Domain.Entities.Inventory.GoodsIssues.GoodsIssue doc, string? supplierName, string? originalCode)
    {
        var label = InventoryRules.Label(doc.Type);
        var detail = doc.Type switch
        {
            Domain.Enums.Inventory.IssueType.XuatDieuChinh => $"phiếu ngược của {originalCode}",
            Domain.Enums.Inventory.IssueType.XuatBan => doc.RecipientName,
            Domain.Enums.Inventory.IssueType.TraNhaCungCap => supplierName ?? doc.Reason,
            _ => doc.Reason
        };
        return string.IsNullOrWhiteSpace(detail) ? label : $"{label} – {detail}";
    }
}
