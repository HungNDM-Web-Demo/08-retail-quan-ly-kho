using System.Globalization;
using Application.Common.Time;
using Domain.Entities.Inventory;

namespace Application.Common.Exceptions;

/// <summary>Lỗi 403, 404, 409 có mã <c>code</c> của nghiệp vụ kho (07 §2.12). Lỗi 400 dùng <see cref="InventoryErrors"/>.</summary>
public static class InventoryProblems
{
    /// <summary>07 §3.8 bước 4: thao tác trên phiên bản cũ, kèm <c>currentVersion</c>.</summary>
    public static ConflictException Stale(int currentVersion) =>
        new(InventoryErrors.StaleMessage, null, new Dictionary<string, object?>
        {
            ["code"] = InventoryErrors.DuLieuCu,
            ["currentVersion"] = currentVersion
        });

    /// <summary>Phiếu đã ghi sổ: "Phiếu {mã} đã được {họ tên} duyệt lúc {HH:mm dd/MM/yyyy}".</summary>
    public static ConflictException AlreadyApproved(string? code, string? approverName, DateTime? approvedAt) =>
        new($"Phiếu {code} đã được {approverName} duyệt lúc {FormatTime(approvedAt)}", null,
            new Dictionary<string, object?> { ["code"] = InventoryErrors.PhieuDaDuyet });

    public static ConflictException Coded(string code, string message, string? field = null, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new ConflictException(message, field, extensions);
    }

    public static CodedForbiddenException NotKeeper(string warehouseCode) =>
        new(InventoryErrors.NotKeeper(warehouseCode), InventoryErrors.KhongPhuTrachKho);

    public static CodedForbiddenException NotReceiver(string warehouseCode) =>
        new(InventoryErrors.NotReceiver(warehouseCode), InventoryErrors.KhongPhuTrachKho);

    public static CodedNotFoundException BarcodeNotFound(string barcode) =>
        new(InventoryErrors.BarcodeNotFound(barcode), InventoryErrors.MaVachKhongTonTai);

    public static string FormatTime(DateTime? utc) =>
        utc is { } value ? VietnamDates.ToVietnam(value).ToString("HH:mm dd/MM/yyyy", CultureInfo.InvariantCulture) : string.Empty;
}

/// <summary>403 kèm <c>code</c>; bộ lọc <c>InventoryProblemFilter</c> của API đưa <c>code</c> vào ProblemDetails.</summary>
public sealed class CodedForbiddenException(string message, string code) : ForbiddenException(message)
{
    public string Code { get; } = code;
}

/// <summary>404 kèm <c>code</c>.</summary>
public sealed class CodedNotFoundException(string message, string code) : NotFoundException(message)
{
    public string Code { get; } = code;
}
