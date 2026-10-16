using Domain.Base;

namespace Domain.Entities.Inventory.Documents;

/// <summary>
/// Phần chung của phiếu nhập, xuất, chuyển: mã (cấp khi gửi duyệt lần đầu), người thao tác chụp tên,
/// khóa lạc quan <see cref="Version"/> và chống bấm lặp <see cref="ClientRequestId"/>, <see cref="LastRequestId"/> (07 §3.8).
/// </summary>
public abstract class InventoryDocument : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public string? Code { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime? SubmittedAt { get; set; }
    public Guid? ApprovedById { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? RejectedById { get; set; }
    public string? RejectedByName { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectReason { get; set; }
    public Guid? CancelledById { get; set; }
    public string? CancelledByName { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? ClientRequestId { get; set; }
    public string? LastRequestId { get; set; }
    public int Version { get; set; } = 1;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public void SetCreatedAt(DateTime value) => CreatedAt = value;

    public void SetUpdatedAt(DateTime? value) => UpdatedAt = value;
}

/// <summary>Phần chung của dòng phiếu nhập, xuất, chuyển: hàng, đơn vị chụp lúc lưu (SRS §5.1), số lượng quy đổi (BR-01).</summary>
public abstract class DocLine : BaseEntity, IAuditLogExempt
{
    public int LineNo { get; set; }
    public Guid ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string BaseUnit { get; set; } = string.Empty;

    /// <summary>null = đơn vị cơ bản.</summary>
    public Guid? UnitId { get; set; }

    public string UnitName { get; set; } = string.Empty;
    public int Factor { get; set; } = 1;
    public int Quantity { get; set; }
    public int BaseQuantity { get; set; }
}
