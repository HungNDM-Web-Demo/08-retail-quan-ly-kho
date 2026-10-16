using Domain.Entities.Inventory.Documents;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory.Transfers;

/// <summary>Phiếu chuyển kho (06 §4 <c>Inventory_Transfers</c>); duyệt trừ kho đi, nhận cộng kho đến (BR-13).</summary>
public class Transfer : InventoryDocument
{
    public Guid FromWarehouseId { get; set; }
    public Guid ToWarehouseId { get; set; }
    public string? Note { get; set; }
    public TransferStatus Status { get; set; }
    public Guid? ReceivedById { get; set; }
    public string? ReceivedByName { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public decimal? TotalValue { get; set; }
    public decimal? ShortageValue { get; set; }

    public List<TransferLine> Lines { get; set; } = [];
}

/// <summary>Dòng phiếu chuyển: giá vốn chuyển lúc duyệt, số thực nhận và hao hụt lúc nhận.</summary>
public class TransferLine : DocLine
{
    public Guid TransferId { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? Value { get; set; }
    public int? ReceivedBaseQuantity { get; set; }
    public int? ShortageQuantity { get; set; }
    public decimal? ShortageValue { get; set; }
}
