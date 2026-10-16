namespace Domain.Enums.Inventory;

/// <summary>Loại phiếu nhập (FR-11, BR-12; 06 §4).</summary>
public enum ReceiptType
{
    MuaHang = 0,
    HangBanTraLai = 1,
    NhapKhac = 2,

    /// <summary>Chỉ sinh từ "Tạo phiếu ngược" của phiếu xuất.</summary>
    NhapDieuChinh = 3
}
