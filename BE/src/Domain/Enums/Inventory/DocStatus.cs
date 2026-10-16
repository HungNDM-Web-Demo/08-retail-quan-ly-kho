namespace Domain.Enums.Inventory;

/// <summary>Trạng thái phiếu nhập, phiếu xuất (SRS §5.2).</summary>
public enum DocStatus
{
    Nhap = 0,
    ChoDuyet = 1,
    TuChoi = 2,
    DaDuyet = 3,
    DaHuy = 4
}
