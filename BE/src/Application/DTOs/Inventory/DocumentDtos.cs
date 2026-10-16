using Application.Common.Models;
using Domain.Enums.Inventory;

namespace Application.DTOs.Inventory;

// Phiếu nhập, phiếu xuất, chuyển kho, Phiếu chờ duyệt (07 §2.4–2.7).

/// <summary>Phần chung của phiếu nhập, xuất, chuyển ở danh sách và chi tiết.</summary>
public abstract class DocumentListItemBase
{
    public Guid Id { get; init; }
    public string? Code { get; init; }
    public int Version { get; init; }
    public Guid CreatedById { get; init; }
    public string CreatedByName { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime? SubmittedAt { get; init; }
    public Guid? ApprovedById { get; init; }
    public string? ApprovedByName { get; init; }
    public DateTime? ApprovedAt { get; init; }
    public string? RejectedByName { get; init; }
    public DateTime? RejectedAt { get; init; }
    public string? RejectReason { get; init; }
    public string? CancelledByName { get; init; }
    public DateTime? CancelledAt { get; init; }
    public int LineCount { get; init; }
    public bool CanViewValues { get; init; }
}

public class GoodsReceiptListItem : DocumentListItemBase
{
    public Guid WarehouseId { get; init; }
    public string WarehouseCode { get; init; } = string.Empty;
    public string WarehouseName { get; init; } = string.Empty;
    public ReceiptType Type { get; init; }
    public Guid? SupplierId { get; init; }
    public string? SupplierCode { get; init; }
    public string? SupplierName { get; init; }
    public string? DelivererName { get; init; }
    public string? SourceDocNo { get; init; }
    public DateOnly? SourceDocDate { get; init; }
    public string? Note { get; init; }
    public decimal? FreightCost { get; init; }
    public decimal? TotalAmount { get; init; }
    public decimal? TotalValue { get; init; }
    public DocStatus Status { get; init; }
    public Guid? ReversalOfId { get; init; }
    public string? ReversalOfCode { get; init; }
    public Guid? ReversedById { get; init; }
    public string? ReversedByCode { get; init; }
}

public sealed class GoodsReceiptDto : GoodsReceiptListItem
{
    public IReadOnlyList<GoodsReceiptLineDto> Lines { get; init; } = [];
}

public sealed class GoodsReceiptLineDto
{
    public Guid Id { get; init; }
    public int LineNo { get; init; }
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public Guid? UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public int Factor { get; init; }
    public int Quantity { get; init; }
    public int BaseQuantity { get; init; }
    public decimal? UnitPrice { get; init; }
    public decimal? Amount { get; init; }
    public decimal? AllocatedCost { get; init; }
    public decimal? Value { get; init; }
    public decimal? LandedUnitPrice { get; init; }
}

public sealed class GoodsReceiptQuery : PaginationQuery
{
    public Guid? WarehouseId { get; set; }
    public ReceiptType? Type { get; set; }
    public DocStatus? Status { get; set; }
    public Guid? SupplierId { get; set; }
    public Guid? CreatedById { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed class ReceiptLineInput : DocLineInput
{
    public decimal UnitPrice { get; set; }
}

public sealed class SaveGoodsReceiptRequest
{
    public Guid WarehouseId { get; set; }
    public ReceiptType Type { get; set; }
    public Guid? SupplierId { get; set; }
    public string? DelivererName { get; set; }
    public string? SourceDocNo { get; set; }
    public DateOnly? SourceDocDate { get; set; }
    public string? Note { get; set; }
    public decimal? FreightCost { get; set; }
    public List<ReceiptLineInput> Lines { get; set; } = [];
    public bool Submit { get; set; }
    public string ClientRequestId { get; set; } = string.Empty;
    public int? Version { get; set; }
}

public class GoodsIssueListItem : DocumentListItemBase
{
    public Guid WarehouseId { get; init; }
    public string WarehouseCode { get; init; } = string.Empty;
    public string WarehouseName { get; init; } = string.Empty;
    public IssueType Type { get; init; }
    public string? RecipientName { get; init; }
    public Guid? SupplierId { get; init; }
    public string? SupplierCode { get; init; }
    public string? SupplierName { get; init; }
    public string? OrderRef { get; init; }
    public string? Reason { get; init; }
    public decimal? TotalValue { get; init; }
    public DocStatus Status { get; init; }
    public Guid? ReversalOfId { get; init; }
    public string? ReversalOfCode { get; init; }
    public Guid? ReversedById { get; init; }
    public string? ReversedByCode { get; init; }
}

public sealed class GoodsIssueDto : GoodsIssueListItem
{
    public IReadOnlyList<GoodsIssueLineDto> Lines { get; init; } = [];
}

public sealed class GoodsIssueLineDto
{
    public Guid Id { get; init; }
    public int LineNo { get; init; }
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public Guid? UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public int Factor { get; init; }
    public int Quantity { get; init; }
    public int BaseQuantity { get; init; }
    public decimal? UnitCost { get; init; }
    public decimal? Value { get; init; }
    public ApprovalPreview? Preview { get; init; }
}

public sealed class GoodsIssueQuery : PaginationQuery
{
    public Guid? WarehouseId { get; set; }
    public IssueType? Type { get; set; }
    public DocStatus? Status { get; set; }
    public Guid? CreatedById { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed class SaveGoodsIssueRequest
{
    public Guid WarehouseId { get; set; }
    public IssueType Type { get; set; }
    public string? RecipientName { get; set; }
    public Guid? SupplierId { get; set; }
    public string? OrderRef { get; set; }
    public string? Reason { get; set; }
    public List<DocLineInput> Lines { get; set; } = [];
    public bool Submit { get; set; }
    public string ClientRequestId { get; set; } = string.Empty;
    public int? Version { get; set; }
}

public class TransferListItem : DocumentListItemBase
{
    public Guid FromWarehouseId { get; init; }
    public string FromWarehouseCode { get; init; } = string.Empty;
    public string FromWarehouseName { get; init; } = string.Empty;
    public Guid ToWarehouseId { get; init; }
    public string ToWarehouseCode { get; init; } = string.Empty;
    public string ToWarehouseName { get; init; } = string.Empty;
    public string? Note { get; init; }
    public TransferStatus Status { get; init; }
    public bool IsLate { get; init; }
    public Guid? ReceivedById { get; init; }
    public string? ReceivedByName { get; init; }
    public DateTime? ReceivedAt { get; init; }
    public decimal? TotalValue { get; init; }
    public decimal? ShortageValue { get; init; }
}

public sealed class TransferDto : TransferListItem
{
    public IReadOnlyList<TransferLineDto> Lines { get; init; } = [];
}

public sealed class TransferLineDto
{
    public Guid Id { get; init; }
    public int LineNo { get; init; }
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public Guid? UnitId { get; init; }
    public string UnitName { get; init; } = string.Empty;
    public int Factor { get; init; }
    public int Quantity { get; init; }
    public int BaseQuantity { get; init; }
    public int? ReceivedBaseQuantity { get; init; }
    public int? ShortageQuantity { get; init; }
    public decimal? UnitCost { get; init; }
    public decimal? Value { get; init; }
    public decimal? ShortageValue { get; init; }
    public ApprovalPreview? Preview { get; init; }
}

public sealed class TransferQuery : PaginationQuery
{
    public Guid? WarehouseId { get; set; }
    public Guid? FromWarehouseId { get; set; }
    public Guid? ToWarehouseId { get; set; }
    public TransferStatus? Status { get; set; }
    public bool? IsLate { get; set; }
    public Guid? CreatedById { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed class SaveTransferRequest
{
    public Guid FromWarehouseId { get; set; }
    public Guid ToWarehouseId { get; set; }
    public string? Note { get; set; }
    public List<DocLineInput> Lines { get; set; } = [];
    public bool Submit { get; set; }
    public string ClientRequestId { get; set; } = string.Empty;
    public int? Version { get; set; }
}

public sealed class ReceiveLineInput
{
    public Guid LineId { get; set; }
    public int ReceivedBaseQuantity { get; set; }
}

public sealed class ReceiveTransferRequest : DocActionRequest
{
    public List<ReceiveLineInput> Lines { get; set; } = [];
}

public sealed class ApprovalItem
{
    public DocKind Kind { get; init; }
    public Guid Id { get; init; }
    public string? Code { get; init; }
    public string TypeText { get; init; } = string.Empty;
    public string WarehouseCode { get; init; } = string.Empty;
    public string? ToWarehouseCode { get; init; }
    public Guid CreatedById { get; init; }
    public string CreatedByName { get; init; } = string.Empty;
    public DateTime SubmittedAt { get; init; }
    public int LineCount { get; init; }
    public decimal? TotalValue { get; init; }
    public bool CanApprove { get; init; }
    public string? BlockedReason { get; init; }
    public int Version { get; init; }
}

public sealed class ApprovalQuery
{
    public DocKind? Kind { get; set; }
    public Guid? WarehouseId { get; set; }
    public Guid? CreatedById { get; set; }
}
