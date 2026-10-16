using API.Filters;
using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Microsoft.AspNetCore.Mvc;
using P = Application.Constants.ProjectPermissions;
using SystemPermissions = Application.Constants.Permissions;

namespace API.Controllers.Inventory;

/// <summary>Tồn kho, giữ chỗ, cảnh báo (07 §2.8).</summary>
[Route("api/stock-levels")]
public sealed class StockLevelsController(IStockService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.StockLevels.View)]
    public Task<StockListResult> GetLevels([FromQuery] StockQuery query, CancellationToken ct) => service.GetLevelsAsync(query, ct);

    [HttpGet("available")]
    [AuthorizePermission(P.GoodsIssues.Create, P.Transfers.Create, P.StockLevels.View)]
    public Task<IReadOnlyList<AvailabilityRow>> GetAvailable([FromQuery] Guid warehouseId, CancellationToken ct) =>
        service.GetAvailabilityAsync(warehouseId, ct);

    [HttpGet("reservations")]
    [AuthorizePermission(P.StockLevels.View)]
    public Task<IReadOnlyList<ReservationDto>> GetReservations([FromQuery] ReservationQuery query, CancellationToken ct) =>
        service.GetReservationsAsync(query, ct);

    [HttpGet("alerts")]
    [AuthorizePermission(P.StockLevels.View)]
    public Task<IReadOnlyList<StockAlertDto>> GetAlerts([FromQuery] StockAlertQuery query, CancellationToken ct) => service.GetAlertsAsync(query, ct);
}

/// <summary>Thẻ kho (07 §2.8, FR-25).</summary>
[Route("api/stock-cards")]
public sealed class StockCardsController(IStockService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.StockLevels.View)]
    public Task<StockCardDto> Get([FromQuery] StockCardQuery query, CancellationToken ct) => service.GetStockCardAsync(query, ct);
}

/// <summary>Tổng quan, Việc cần làm, báo cáo (07 §2.10).</summary>
[Route("api/reports")]
public sealed class ReportsController(IInventoryReportService service) : InventoryControllerBase
{
    [HttpGet("dashboard")]
    [AuthorizePermission(P.Reports.View)]
    public Task<DashboardReport> GetDashboard(CancellationToken ct) => service.GetDashboardAsync(ct);

    [HttpGet("staff-todo")]
    [AuthorizePermission(SystemPermissions.Dashboard.View)]
    public Task<StaffTodo> GetStaffTodo(CancellationToken ct) => service.GetStaffTodoAsync(ct);

    [HttpGet("inventory-movement")]
    [AuthorizePermission(P.Reports.View)]
    public Task<MovementReport> GetMovement([FromQuery] MovementQuery query, CancellationToken ct) => service.GetMovementAsync(query, ct);

    [HttpGet("slow-moving")]
    [AuthorizePermission(P.Reports.View)]
    public Task<IReadOnlyList<SlowMovingRow>> GetSlowMoving([FromQuery] SlowMovingQuery query, CancellationToken ct) => service.GetSlowMovingAsync(query, ct);

    [HttpGet("receipts-by-supplier")]
    [AuthorizePermission(P.Reports.View)]
    public Task<IReadOnlyList<SupplierReceiptRow>> GetReceiptsBySupplier([FromQuery] ReportPeriodQuery query, CancellationToken ct) =>
        service.GetReceiptsBySupplierAsync(query, ct);

    [HttpGet("issues-by-type")]
    [AuthorizePermission(P.Reports.View)]
    public Task<IReadOnlyList<IssueTypeRow>> GetIssuesByType([FromQuery] ReportPeriodQuery query, CancellationToken ct) =>
        service.GetIssuesByTypeAsync(query, ct);

    [HttpGet("stocktake-variances")]
    [AuthorizePermission(P.Reports.View)]
    public Task<IReadOnlyList<StocktakeVarianceRow>> GetStocktakeVariances([FromQuery] ReportPeriodQuery query, CancellationToken ct) =>
        service.GetStocktakeVariancesAsync(query, ct);

    [HttpGet("transfer-losses")]
    [AuthorizePermission(P.Reports.View)]
    public Task<IReadOnlyList<TransferLossRow>> GetTransferLosses([FromQuery] TransferLossQuery query, CancellationToken ct) =>
        service.GetTransferLossesAsync(query, ct);
}
