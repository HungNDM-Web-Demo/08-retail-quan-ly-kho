namespace Domain.Enums.Inventory;

/// <summary>Trạng thái tồn của một mặt hàng tại một kho (BR-18). Tính khi đọc, không lưu.</summary>
public enum StockStatus
{
    BinhThuong,
    HetHang,
    DuoiToiThieu,
    VuotToiDa
}
