namespace Domain.Enums.Inventory;

/// <summary>Loại chứng từ ở Phiếu chờ duyệt, Việc cần làm, liên kết thẻ kho (07 §2). Không lưu DB.</summary>
public enum DocKind
{
    GoodsReceipt,
    GoodsIssue,
    Transfer,
    Stocktake
}
