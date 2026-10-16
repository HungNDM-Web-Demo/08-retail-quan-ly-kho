using Domain.Entities.Inventory.Documents;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory.GoodsReceipts;

/// <summary>Phiếu nhập (06 §4 <c>Inventory_GoodsReceipts</c>).</summary>
public class GoodsReceipt : InventoryDocument
{
    public Guid WarehouseId { get; set; }
    public ReceiptType Type { get; set; }
    public Guid? SupplierId { get; set; }
    public string? DelivererName { get; set; }
    public string? SourceDocNo { get; set; }
    public DateOnly? SourceDocDate { get; set; }
    public string? Note { get; set; }
    public decimal FreightCost { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal TotalValue { get; set; }
    public DocStatus Status { get; set; }

    /// <summary>Phiếu xuất gốc khi đây là phiếu ngược (<see cref="ReceiptType.NhapDieuChinh"/>, BR-12).</summary>
    public Guid? ReversalOfIssueId { get; set; }

    public List<GoodsReceiptLine> Lines { get; set; } = [];
}

/// <summary>Dòng phiếu nhập: giá theo đơn vị đã chọn, chi phí phân bổ BR-08, giá trị nhập kho.</summary>
public class GoodsReceiptLine : DocLine
{
    public Guid ReceiptId { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
    public decimal AllocatedCost { get; set; }
    public decimal Value { get; set; }
}
