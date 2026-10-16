using System.Globalization;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory;

/// <summary>Hằng số nghiệp vụ (06 §3; FE <c>InventoryRules</c> cùng giá trị) và nhãn tiếng Việt dùng trong câu lỗi, thẻ kho.</summary>
public static class InventoryRules
{
    /// <summary>Tối đa 200 dòng mỗi phiếu (BR-07, NFR-02).</summary>
    public const int MaxLines = 200;

    /// <summary>Hệ số quy đổi 2–10.000 (BR-01).</summary>
    public const int MinFactor = 2;

    public const int MaxFactor = 10_000;

    /// <summary>Tối đa 2 đơn vị quy đổi (FR-07).</summary>
    public const int MaxUnits = 2;

    /// <summary>Phiếu chuyển "Trễ" khi đang chuyển quá 3 ngày (BR-13).</summary>
    public const int LateDays = 3;

    /// <summary>Lý do từ chối tối thiểu 10 ký tự (BR-06).</summary>
    public const int MinRejectReason = 10;

    /// <summary>Dòng kiểm kê bắt buộc nguyên nhân khi giá trị chênh từ 1.000.000 ₫ (BR-16).</summary>
    public const decimal VarianceValueThreshold = 1_000_000m;

    /// <summary>... hoặc chênh từ 5% sổ sách (BR-16).</summary>
    public const int VariancePercentThreshold = 5;

    /// <summary>Khoảng ngày tối đa của bộ lọc, báo cáo (UC-09 E2).</summary>
    public const int MaxRangeDays = 366;

    public const string ReceiptPrefix = "PN";
    public const string IssuePrefix = "PX";
    public const string TransferPrefix = "PC";
    public const string StocktakePrefix = "KK";

    /// <summary>Số nguyên định dạng Việt Nam: 1.200.</summary>
    public static string Number(decimal value) =>
        value.ToString("#,0", CultureInfo.InvariantCulture).Replace(',', '.');

    public static string Money(decimal value) => Number(value) + " ₫";

    public static string Label(ReceiptType type) => type switch
    {
        ReceiptType.MuaHang => "Mua hàng",
        ReceiptType.HangBanTraLai => "Hàng bán bị trả lại",
        ReceiptType.NhapKhac => "Nhập khác",
        _ => "Nhập điều chỉnh"
    };

    public static string Label(IssueType type) => type switch
    {
        IssueType.XuatBan => "Xuất bán",
        IssueType.TraNhaCungCap => "Trả nhà cung cấp",
        IssueType.DungNoiBo => "Dùng nội bộ",
        IssueType.XuatHuy => "Xuất hủy",
        _ => "Xuất điều chỉnh"
    };

    public static string Label(DocStatus status) => status switch
    {
        DocStatus.Nhap => "Nháp",
        DocStatus.ChoDuyet => "Chờ duyệt",
        DocStatus.TuChoi => "Từ chối",
        DocStatus.DaDuyet => "Đã duyệt",
        _ => "Đã hủy"
    };

    public static string Label(TransferStatus status) => status switch
    {
        TransferStatus.Nhap => "Nháp",
        TransferStatus.ChoDuyet => "Chờ duyệt",
        TransferStatus.TuChoi => "Từ chối",
        TransferStatus.DangChuyen => "Đang chuyển",
        TransferStatus.DaNhan => "Đã nhận",
        _ => "Đã hủy"
    };

    public static string Label(StocktakeStatus status) => status switch
    {
        StocktakeStatus.DangKiem => "Đang kiểm",
        StocktakeStatus.ChoDuyet => "Chờ duyệt",
        StocktakeStatus.DaCanBang => "Đã cân bằng",
        _ => "Đã hủy"
    };

    public static string Label(VarianceReason reason) => reason switch
    {
        VarianceReason.HuHong => "Hư hỏng",
        VarianceReason.MatMat => "Mất mát",
        VarianceReason.NhapXuatChuaLapPhieu => "Nhập xuất chưa lập phiếu",
        VarianceReason.NhamMaHang => "Nhầm mã hàng",
        _ => "Khác"
    };
}
