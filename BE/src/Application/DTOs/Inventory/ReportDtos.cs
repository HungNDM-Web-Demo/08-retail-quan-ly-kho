using Domain.Enums.Inventory;

namespace Application.DTOs.Inventory;

// Tổng quan, Việc cần làm, báo cáo (07 §2.10).

public sealed record DashboardWarehouse(Guid WarehouseId, string Code, string Name, decimal StockValue, int StockedProductCount);

public sealed record PendingCounts(int GoodsReceipts, int GoodsIssues, int Transfers, int Stocktakes, int Total);

public sealed record InTransitSummary(int Count, decimal Value, int LateCount);

public sealed record DailyMovement(string Date, decimal InValue, decimal OutValue);

public sealed record TopIssued(Guid ProductId, string Code, string Name, string BaseUnit, int Quantity, decimal Value);

public sealed class DashboardReport
{
    public DateTime AsOf { get; init; }
    public IReadOnlyList<DashboardWarehouse> Warehouses { get; init; } = [];
    public decimal TotalStockValue { get; init; }
    public int BelowMinCount { get; init; }
    public int OutOfStockCount { get; init; }
    public int OverMaxCount { get; init; }
    public PendingCounts Pending { get; init; } = null!;
    public InTransitSummary InTransit { get; init; } = null!;
    public IReadOnlyList<DailyMovement> Daily { get; init; } = [];
    public IReadOnlyList<TopIssued> TopIssued { get; init; } = [];
}

public class TodoDoc
{
    public DocKind Kind { get; init; }
    public Guid Id { get; init; }
    public string? Code { get; init; }
    public string WarehouseCode { get; init; } = string.Empty;
    public string? ToWarehouseCode { get; init; }
    public string TypeText { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public int LineCount { get; init; }
}

public sealed class RejectedTodoDoc : TodoDoc
{
    public string RejectReason { get; init; } = string.Empty;
    public string RejectedByName { get; init; } = string.Empty;
    public DateTime RejectedAt { get; init; }
}

public sealed class ReceiveTodoDoc : TodoDoc
{
    public string FromWarehouseCode { get; init; } = string.Empty;
    public DateTime ApprovedAt { get; init; }
    public bool IsLate { get; init; }
}

public sealed class CountingTodoDoc : TodoDoc
{
    public string CounterName { get; init; } = string.Empty;
    public int CountedLines { get; init; }
    public int TotalLines { get; init; }
}

public sealed class StaffTodo
{
    public IReadOnlyList<WarehouseOption> Warehouses { get; init; } = [];
    public IReadOnlyList<TodoDoc> Drafts { get; init; } = [];
    public IReadOnlyList<RejectedTodoDoc> Rejected { get; init; } = [];
    public IReadOnlyList<TodoDoc> Waiting { get; init; } = [];
    public IReadOnlyList<ReceiveTodoDoc> ToReceive { get; init; } = [];
    public IReadOnlyList<CountingTodoDoc> Counting { get; init; } = [];
}

public class ReportPeriodQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public Guid? WarehouseId { get; set; }
}

public sealed class MovementQuery : ReportPeriodQuery
{
    public Guid? GroupId { get; set; }
}

public sealed class MovementRow
{
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public int OpeningQty { get; set; }
    public decimal OpeningValue { get; set; }
    public int InQty { get; set; }
    public decimal InValue { get; set; }
    public int OutQty { get; set; }
    public decimal OutValue { get; set; }
    public int ClosingQty { get; set; }
    public decimal ClosingValue { get; set; }
}

public sealed record MovementTotals(
    int OpeningQty, decimal OpeningValue, int InQty, decimal InValue, int OutQty, decimal OutValue, int ClosingQty, decimal ClosingValue);

public sealed record InTransitLine(Guid ProductId, string ProductCode, string ProductName, string BaseUnit, int Quantity, decimal Value);

public sealed record InTransitBlock(decimal TotalValue, IReadOnlyList<InTransitLine> Lines);

public sealed class MovementReport
{
    public string From { get; init; } = string.Empty;
    public string To { get; init; } = string.Empty;
    public Guid? WarehouseId { get; init; }
    public IReadOnlyList<MovementRow> Rows { get; init; } = [];
    public MovementTotals Totals { get; init; } = null!;
    public InTransitBlock? InTransit { get; init; }
}

public sealed class SlowMovingQuery
{
    public Guid? WarehouseId { get; set; }
    public Guid? GroupId { get; set; }
}

public sealed class SlowMovingRow
{
    public Guid ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string GroupName { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public Guid WarehouseId { get; init; }
    public string WarehouseCode { get; init; } = string.Empty;
    public int OnHand { get; init; }
    public decimal? StockValue { get; init; }
    public DateTime? LastIssueAt { get; init; }
    public DateTime? FirstReceiptAt { get; init; }
    public int DaysSince { get; init; }
    public SlowMovingBucket Bucket { get; init; }
}

public sealed record SupplierReceiptRow(
    Guid SupplierId, string SupplierCode, string SupplierName, int ReceiptCount, decimal TotalAmount, decimal FreightCost,
    decimal TotalValue, decimal SharePercent);

public sealed record IssueTypeRow(IssueType Type, int DocCount, int BaseQuantity, decimal Value, decimal SharePercent);

public sealed record VarianceByReason(VarianceReason? Reason, int LineCount, decimal Value);

public sealed record StocktakeVarianceRow(
    Guid StocktakeId, string Code, string WarehouseCode, DateTime ApprovedAt, int LineCount, int VarianceLineCount,
    decimal SurplusValue, decimal ShortageValue, decimal NetValue, IReadOnlyList<VarianceByReason> ByReason);

public sealed record TransferLossItem(Guid Id, string Code, DateTime ReceivedAt, int ShortageQuantity, decimal ShortageValue);

public sealed record TransferLossRow(
    string FromWarehouseCode, string ToWarehouseCode, int TransferCount, int ShortageLineCount, decimal ShortageValue,
    IReadOnlyList<TransferLossItem> Transfers);

public sealed class TransferLossQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public Guid? FromWarehouseId { get; set; }
    public Guid? ToWarehouseId { get; set; }
}
