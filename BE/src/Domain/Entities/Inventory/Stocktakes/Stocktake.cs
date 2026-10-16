using Domain.Base;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory.Stocktakes;

/// <summary>Phiếu kiểm kê (06 §4 <c>Inventory_Stocktakes</c>); mã <c>KK</c> cấp lúc tạo, chốt sổ sách lúc tạo.</summary>
public class Stocktake : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public string Code { get; set; } = string.Empty;
    public Guid WarehouseId { get; set; }
    public bool ScopeAll { get; set; }

    /// <summary>Mảng JSON Id nhóm hàng khi không toàn kho.</summary>
    public string? ScopeGroupIds { get; set; }

    public StocktakeStatus Status { get; set; }
    public DateTime SnapshotAt { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public Guid CounterId { get; set; }
    public string CounterName { get; set; } = string.Empty;
    public Guid? SubmittedById { get; set; }
    public string? SubmittedByName { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public Guid? ApprovedById { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? CancelledById { get; set; }
    public string? CancelledByName { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? Note { get; set; }
    public string? ReturnNote { get; set; }
    public decimal? SurplusValue { get; set; }
    public decimal? ShortageValue { get; set; }
    public string? ClientRequestId { get; set; }
    public string? LastRequestId { get; set; }
    public int Version { get; set; } = 1;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<StocktakeLine> Lines { get; set; } = [];
    public List<StocktakeCount> Counts { get; set; } = [];

    public void SetCreatedAt(DateTime value) => CreatedAt = value;
}

/// <summary>Dòng kiểm kê: tồn sổ sách chốt, số đếm, chênh lệch (BR-16).</summary>
public class StocktakeLine : BaseEntity, IAuditLogExempt
{
    public Guid StocktakeId { get; set; }
    public Guid ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public Guid GroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string BaseUnit { get; set; } = string.Empty;
    public int BookQuantity { get; set; }
    public decimal BookCost { get; set; }
    public int? CountedQuantity { get; set; }
    public int? Difference { get; set; }
    public decimal? DifferenceValue { get; set; }
    public bool ReasonRequired { get; set; }
    public VarianceReason? Reason { get; set; }
    public string? ReasonNote { get; set; }
    public bool NeedsRecount { get; set; }
    public string? RecountNote { get; set; }
    public bool IsAdded { get; set; }
    public Guid? LastCountedById { get; set; }
    public string? LastCountedByName { get; set; }
    public DateTime? LastCountedAt { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>Một lượt gửi số đếm; unique <c>(StocktakeId, ClientRequestId)</c> chống cộng hai lần.</summary>
public class StocktakeCount : BaseEntity, IAuditLogExempt
{
    public Guid StocktakeId { get; set; }
    public string ClientRequestId { get; set; } = string.Empty;
    public string Entries { get; set; } = "[]";
    public Guid CountedById { get; set; }
    public string CountedByName { get; set; } = string.Empty;
}
