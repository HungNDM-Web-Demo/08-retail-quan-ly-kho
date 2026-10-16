using Domain.Base;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory.Stock;

/// <summary>
/// Tồn của mặt hàng tại kho (06 §4 <c>Inventory_StockLevels</c>): số dư sau dòng thẻ kho cuối cùng.
/// Chỉ <c>StockPostingService</c> đổi <see cref="OnHand"/>, <see cref="StockValue"/>, <see cref="AvgCost"/> (BR-05, BR-11).
/// </summary>
public class StockLevel : BaseEntity, IAuditLogExempt
{
    public Guid WarehouseId { get; set; }
    public Guid ProductId { get; set; }
    public int OnHand { get; set; }
    public decimal StockValue { get; set; }
    public decimal AvgCost { get; set; }
    public int? MinQty { get; set; }
    public int? MaxQty { get; set; }
    public DateTime? LastIssueAt { get; set; }
    public DateTime? FirstReceiptAt { get; set; }

    /// <summary>Concurrency token (NFR-03), tăng 1 mỗi lần ghi sổ.</summary>
    public int Version { get; set; } = 1;
}

/// <summary>Một dòng thẻ kho (06 §4 <c>Inventory_StockLedger</c>): ghi một chiều, không sửa, không xóa.</summary>
public class StockLedgerEntry : BaseEntity, IAuditLogExempt
{
    public Guid WarehouseId { get; set; }
    public Guid ProductId { get; set; }
    public DateTime PostedAt { get; set; }
    public long Seq { get; set; }
    public LedgerDocType DocType { get; set; }
    public Guid DocId { get; set; }
    public string DocCode { get; set; } = string.Empty;
    public Guid DocLineId { get; set; }
    public int? SubType { get; set; }
    public Guid? CounterpartWarehouseId { get; set; }
    public string Description { get; set; } = string.Empty;
    public int InQuantity { get; set; }
    public int OutQuantity { get; set; }
    public int BalanceQuantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal InValue { get; set; }
    public decimal OutValue { get; set; }
    public decimal BalanceValue { get; set; }
    public decimal AvgCostAfter { get; set; }

    public void SetCreatedAt(DateTime value) => CreatedAt = value;
}

/// <summary>
/// Các dòng tồn đang ghi sổ, tra theo (kho, hàng). Dòng chưa có thì tạo mới (tồn 0) và báo qua <c>onCreate</c>
/// để nơi gọi thêm vào DB. Dùng chung cho ghi sổ khi duyệt và khi nạp dữ liệu mẫu.
/// </summary>
public sealed class StockBook(IEnumerable<StockLevel> levels, Action<StockLevel> onCreate)
{
    private readonly Dictionary<(Guid, Guid), StockLevel> _levels =
        levels.ToDictionary(l => (l.WarehouseId, l.ProductId));

    public IEnumerable<StockLevel> All => _levels.Values;

    public StockLevel Get(Guid warehouseId, Guid productId)
    {
        if (_levels.TryGetValue((warehouseId, productId), out var level))
            return level;

        level = new StockLevel { WarehouseId = warehouseId, ProductId = productId };
        _levels[(warehouseId, productId)] = level;
        onCreate(level);
        return level;
    }

    public StockLevel? Find(Guid warehouseId, Guid productId) =>
        _levels.GetValueOrDefault((warehouseId, productId));
}
