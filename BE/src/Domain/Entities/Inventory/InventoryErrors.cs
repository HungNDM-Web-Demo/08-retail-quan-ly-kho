using Domain.Common;

namespace Domain.Entities.Inventory;

/// <summary>
/// Mã lỗi nghiệp vụ (07 §2.12): ProblemDetails có trường <c>code</c>, <c>detail</c> đúng câu trong bảng.
/// Lỗi 400 ném <see cref="DomainException"/> qua <see cref="Business"/>; 403, 404, 409 dựng ở Application (<c>InventoryProblems</c>).
/// </summary>
public static class InventoryErrors
{
    public const string DuLieuCu = "DuLieuCu";
    public const string PhieuDaDuyet = "PhieuDaDuyet";
    public const string TrangThaiKhongHopLe = "TrangThaiKhongHopLe";
    public const string KhongPhaiNguoiLap = "KhongPhaiNguoiLap";
    public const string NguoiDuyetTrungNguoiLap = "NguoiDuyetTrungNguoiLap";
    public const string KhongPhuTrachKho = "KhongPhuTrachKho";
    public const string VuotTonKhaDung = "VuotTonKhaDung";
    public const string KhongDuTonThuc = "KhongDuTonThuc";
    public const string DangKiemKe = "DangKiemKe";
    public const string KhoDaCoPhieuKiemKe = "KhoDaCoPhieuKiemKe";
    public const string KhongCoHangKiemKe = "KhongCoHangKiemKe";
    public const string NgoaiPhamViKiemKe = "NgoaiPhamViKiemKe";
    public const string ConDongChuaDem = "ConDongChuaDem";
    public const string ThieuNguyenNhan = "ThieuNguyenNhan";
    public const string KhoConTon = "KhoConTon";
    public const string DaCoChungTu = "DaCoChungTu";
    public const string NhomConHang = "NhomConHang";
    public const string DonViDaDung = "DonViDaDung";
    public const string MaVachTrung = "MaVachTrung";
    public const string MaVachKhongTonTai = "MaVachKhongTonTai";
    public const string PhieuNguocDaCo = "PhieuNguocDaCo";
    public const string KhongTaoPhieuNguoc = "KhongTaoPhieuNguoc";

    public const string StaleMessage = "Phiếu vừa được cập nhật, đang tải lại";
    public const string NotCreatorMessage = "Chỉ người lập được sửa, gửi hoặc rút phiếu này";
    public const string SameApproverMessage = "Người duyệt phải khác người lập";
    public const string SameCounterMessage = "Người duyệt phải khác người đếm";
    public const string NoStocktakeItemsMessage = "Phạm vi kiểm kê không có mặt hàng nào còn tồn";
    public const string UnitUsedMessage = "Đơn vị đã có chứng từ";
    public const string CannotReverseMessage = "Chỉ tạo phiếu ngược từ phiếu đã duyệt, không phải phiếu điều chỉnh";

    public static string InvalidStatus(string statusLabel) =>
        $"Phiếu đang ở trạng thái {statusLabel}, không thực hiện được thao tác này";

    public static string NotKeeper(string warehouseCode) => $"Bạn không phụ trách kho {warehouseCode}";

    public static string NotReceiver(string warehouseCode) => $"Chỉ thủ kho phụ trách {warehouseCode} được xác nhận nhận hàng";

    public static string OverAvailable(int excess, string baseUnit) =>
        $"Vượt tồn khả dụng {InventoryRules.Number(excess)} {baseUnit.ToLowerInvariant()}";

    public static string OverAvailableLines(int count) => $"Có {count} dòng vượt tồn khả dụng";

    public static string NotEnoughOnHand(string productName, int missing, string baseUnit) =>
        $"Không đủ tồn thực: {productName} thiếu {InventoryRules.Number(missing)} {baseUnit.ToLowerInvariant()}";

    public static string Counting(string productName, string warehouseCode, string stocktakeCode) =>
        $"{productName} đang kiểm kê tại {warehouseCode} ({stocktakeCode})";

    public static string WarehouseHasStocktake(string warehouseCode, string stocktakeCode) =>
        $"Kho {warehouseCode} đang có phiếu kiểm kê {stocktakeCode} chưa kết thúc";

    public static string OutOfStocktakeScope(string productName) => $"{productName} không thuộc phạm vi phiếu kiểm kê";

    public static string Uncounted(int count) => $"Còn {count} dòng chưa đếm";

    public static string MissingReasons(int count) => $"Chọn nguyên nhân cho {count} dòng chênh lệch lớn";

    public static string WarehouseHasStock(string code, int productCount, int openDocuments) =>
        $"Kho {code} còn {productCount} mặt hàng tồn và {openDocuments} phiếu chưa kết thúc, không ngừng hoạt động được";

    public static string HasDocuments(string subject) => $"{subject} đã có chứng từ, không xóa được. Hãy dùng Ngừng";

    public static string GroupHasProducts(int count) =>
        $"Nhóm hàng đang có {count} mặt hàng, chuyển mặt hàng sang nhóm khác trước";

    public static string BarcodeUsed(string productName, string unitName) => $"Mã vạch đã dùng cho {productName} – {unitName}";

    public static string BarcodeNotFound(string barcode) => $"Không tìm thấy mã {barcode}";

    public static string AlreadyReversed(string? originalCode, string? reversalCode) =>
        $"Phiếu {originalCode} đã có phiếu ngược {reversalCode ?? "nháp"}";

    public static DomainException Business(string code, string message, IReadOnlyDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["code"] = code };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
                extensions[key] = value;
        }

        return new DomainException(message, extensions);
    }

    /// <summary>Lỗi 400 vừa có <c>code</c> vừa gắn <c>errors</c> theo trường.</summary>
    public static DomainException WithErrors(
        string code,
        string message,
        IDictionary<string, string[]> errors,
        IReadOnlyDictionary<string, object?>? extra = null)
    {
        var all = new Dictionary<string, object?>(extra ?? new Dictionary<string, object?>()) { ["errors"] = errors };
        return Business(code, message, all);
    }
}
