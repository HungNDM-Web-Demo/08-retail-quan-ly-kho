using Application.Common.Models;
using Domain.Enums.Inventory;

namespace Application.DTOs.Inventory;

// Tồn kho, cảnh báo, giữ chỗ, thẻ kho (07 §2.8) và kiểm kê (07 §2.9).

public sealed record AvailabilityRow(Guid ProductId, int OnHand, int Reserved, int Available);

public sealed record StockByWarehouse(Guid WarehouseId, string WarehouseCode, int OnHand, int Available, StockStatus Status);

public sealed class StockRowDto
{
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public string GroupColor { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public IReadOnlyList<UnitReading> Units { get; init; } = [];
    public string? ImageUrl { get; init; }
    public Guid? WarehouseId { get; init; }
    public int OnHand { get; init; }
    public int Reserved { get; init; }
    public int Available { get; init; }
    public string Reading { get; init; } = string.Empty;
    public decimal? AvgCost { get; init; }
    public decimal? StockValue { get; init; }
    public int? MinQty { get; init; }
    public int? MaxQty { get; init; }
    public StockStatus? Status { get; init; }
    public IReadOnlyList<StockByWarehouse>? ByWarehouse { get; init; }
}

public sealed class StockQuery : PaginationQuery
{
    public Guid? WarehouseId { get; set; }
    public Guid? GroupId { get; set; }
    public StockStatus? Status { get; set; }
    public bool? InStockOnly { get; set; }
}

public sealed class StockListResult
{
    public IReadOnlyList<StockRowDto> Items { get; init; } = [];
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
    public decimal? TotalValue { get; init; }
    public bool CanViewValues { get; init; }
}

public sealed record ReservationDto(
    DocKind Kind,
    Guid DocId,
    string? DocCode,
    string WarehouseCode,
    string? ToWarehouseCode,
    string CreatedByName,
    DateTime SubmittedAt,
    int BaseQuantity);

public sealed record AlertSource(Guid WarehouseId, string WarehouseCode, string WarehouseName, int Available);

public sealed class StockAlertDto
{
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string GroupName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public IReadOnlyList<UnitReading> Units { get; init; } = [];
    public Guid WarehouseId { get; init; }
    public string WarehouseCode { get; init; } = string.Empty;
    public int OnHand { get; init; }
    public int Available { get; init; }
    public int? MinQty { get; init; }
    public int? MaxQty { get; init; }
    public StockStatus Status { get; init; }
    public int? SuggestedQuantity { get; init; }
    public string? SuggestedReading { get; init; }
    public IReadOnlyList<AlertSource> Sources { get; init; } = [];
}

public sealed class StockAlertQuery
{
    public Guid? WarehouseId { get; set; }
    public StockStatus? Status { get; set; }
    public Guid? GroupId { get; set; }
}

public sealed class ReservationQuery
{
    public Guid? WarehouseId { get; set; }
    public Guid? ProductId { get; set; }
}

public sealed class StockCardQuery
{
    public Guid ProductId { get; set; }
    public Guid? WarehouseId { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed class StockCardLineDto
{
    public Guid Id { get; init; }
    public DateTime PostedAt { get; init; }
    public Guid WarehouseId { get; init; }
    public string WarehouseCode { get; init; } = string.Empty;
    public LedgerDocType DocType { get; init; }
    public DocKind DocKind { get; init; }
    public Guid DocId { get; init; }
    public string DocCode { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public int InQuantity { get; init; }
    public int OutQuantity { get; init; }
    public int BalanceQuantity { get; init; }
    public decimal? UnitCost { get; init; }
    public decimal? InValue { get; init; }
    public decimal? OutValue { get; init; }
    public decimal? BalanceValue { get; init; }
    public decimal? AvgCostAfter { get; init; }
}

public sealed record StockCardProduct(Guid Id, string Code, string Name, string BaseUnit, IReadOnlyList<UnitReading> Units);

public sealed record QuantityValue(int Quantity, decimal? Value);

public sealed record StockCardTotals(int InQuantity, int OutQuantity, decimal? InValue, decimal? OutValue);

public sealed class StockCardDto
{
    public StockCardProduct Product { get; init; } = null!;
    public Guid? WarehouseId { get; init; }
    public string? WarehouseCode { get; init; }
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public QuantityValue Opening { get; init; } = null!;
    public StockCardTotals Totals { get; init; } = null!;
    public QuantityValue Closing { get; init; } = null!;
    public IReadOnlyList<StockCardLineDto> Lines { get; init; } = [];
    public bool CanViewValues { get; init; }
}

public sealed class StocktakeLineDto
{
    public Guid Id { get; init; }
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public IReadOnlyList<CatalogUnit> Units { get; init; } = [];
    public string? Barcode { get; init; }
    public int? BookQuantity { get; init; }
    public decimal? BookCost { get; init; }
    public int? CountedQuantity { get; init; }
    public int? Difference { get; init; }
    public decimal? DifferencePercent { get; init; }
    public decimal? DifferenceValue { get; init; }
    public bool? ReasonRequired { get; init; }
    public VarianceReason? Reason { get; init; }
    public string? ReasonNote { get; init; }
    public bool NeedsRecount { get; init; }
    public string? RecountNote { get; init; }
    public bool IsAdded { get; init; }
    public string? LastCountedByName { get; init; }
    public DateTime? LastCountedAt { get; init; }
}

public sealed record GroupRef(Guid Id, string Name);

public class StocktakeListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public Guid WarehouseId { get; init; }
    public string WarehouseCode { get; init; } = string.Empty;
    public string WarehouseName { get; init; } = string.Empty;
    public bool ScopeAll { get; init; }
    public IReadOnlyList<GroupRef> Groups { get; init; } = [];
    public StocktakeStatus Status { get; init; }
    public int Version { get; init; }
    public DateTime SnapshotAt { get; init; }
    public Guid CreatedById { get; init; }
    public string CreatedByName { get; init; } = string.Empty;
    public Guid CounterId { get; init; }
    public string CounterName { get; init; } = string.Empty;
    public string? SubmittedByName { get; init; }
    public DateTime? SubmittedAt { get; init; }
    public Guid? ApprovedById { get; init; }
    public string? ApprovedByName { get; init; }
    public DateTime? ApprovedAt { get; init; }
    public string? CancelledByName { get; init; }
    public DateTime? CancelledAt { get; init; }
    public string? Note { get; init; }
    public string? ReturnNote { get; init; }
    public int TotalLines { get; init; }
    public int CountedLines { get; init; }
    public decimal? SurplusValue { get; init; }
    public decimal? ShortageValue { get; init; }
    public bool IsBlind { get; init; }
    public bool CanViewValues { get; init; }
}

public sealed class StocktakeDto : StocktakeListItem
{
    public IReadOnlyList<StocktakeLineDto> Lines { get; init; } = [];
}

public sealed class StocktakeQuery : PaginationQuery
{
    public Guid? WarehouseId { get; set; }
    public StocktakeStatus? Status { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed class CreateStocktakeRequest
{
    public Guid WarehouseId { get; set; }
    public bool ScopeAll { get; set; }
    public List<Guid> GroupIds { get; set; } = [];
    public Guid CounterId { get; set; }
    public string? Note { get; set; }
    public string ClientRequestId { get; set; } = string.Empty;
}

public sealed class CountEntry
{
    public Guid ProductId { get; set; }
    public Guid? UnitId { get; set; }
    public int Quantity { get; set; }
    public CountMode Mode { get; set; }
}

public sealed class SubmitCountsRequest
{
    public string ClientRequestId { get; set; } = string.Empty;
    public List<CountEntry> Entries { get; set; } = [];
}

public sealed class StocktakeReasonInput
{
    public Guid LineId { get; set; }
    public VarianceReason Reason { get; set; }
    public string? Note { get; set; }
}

public sealed class SubmitStocktakeRequest : DocActionRequest
{
    public List<StocktakeReasonInput> Reasons { get; set; } = [];
}

public sealed class ReturnStocktakeRequest : DocActionRequest
{
    public List<Guid> LineIds { get; set; } = [];
    public string? Note { get; set; }
}
