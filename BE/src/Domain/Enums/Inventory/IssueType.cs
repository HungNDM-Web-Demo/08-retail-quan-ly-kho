namespace Domain.Enums.Inventory;

/// <summary>Loại phiếu xuất (FR-14, BR-12; 06 §4).</summary>
public enum IssueType
{
    XuatBan = 0,
    TraNhaCungCap = 1,
    DungNoiBo = 2,
    XuatHuy = 3,

    /// <summary>Chỉ sinh từ "Tạo phiếu ngược" của phiếu nhập.</summary>
    XuatDieuChinh = 4
}
