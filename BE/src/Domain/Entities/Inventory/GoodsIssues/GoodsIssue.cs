using Domain.Entities.Inventory.Documents;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory.GoodsIssues;

/// <summary>Phiếu xuất (06 §4 <c>Inventory_GoodsIssues</c>).</summary>
public class GoodsIssue : InventoryDocument
{
    public Guid WarehouseId { get; set; }
    public IssueType Type { get; set; }
    public string? RecipientName { get; set; }
    public Guid? SupplierId { get; set; }
    public string? OrderRef { get; set; }
    public string? Reason { get; set; }
    public decimal? TotalValue { get; set; }
    public DocStatus Status { get; set; }

    /// <summary>Phiếu nhập gốc khi đây là phiếu ngược (<see cref="IssueType.XuatDieuChinh"/>, BR-12).</summary>
    public Guid? ReversalOfReceiptId { get; set; }

    public List<GoodsIssueLine> Lines { get; set; } = [];
}

/// <summary>Dòng phiếu xuất: giá vốn, giá trị ghi khi duyệt (BR-10).</summary>
public class GoodsIssueLine : DocLine
{
    public Guid IssueId { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? Value { get; set; }
}
