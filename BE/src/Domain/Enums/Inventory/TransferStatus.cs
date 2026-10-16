namespace Domain.Enums.Inventory;

/// <summary>Trạng thái phiếu chuyển kho (SRS §5.2).</summary>
public enum TransferStatus
{
    Nhap = 0,
    ChoDuyet = 1,
    TuChoi = 2,
    DangChuyen = 3,
    DaNhan = 4,
    DaHuy = 5
}
