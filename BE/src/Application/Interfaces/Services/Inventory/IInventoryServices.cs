using Application.Common.Models;
using Application.DTOs.Inventory;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Transfers;

namespace Application.Interfaces.Services.Inventory;

/// <summary>Người thao tác của request: họ tên, quyền, phạm vi kho (BR-23, 07 §1 "Phạm vi kho").</summary>
public sealed class InventoryActor
{
    public required Guid UserId { get; init; }
    public required string Username { get; init; }
    public required string FullName { get; init; }
    public required UserAccess Access { get; init; }

    /// <summary>Có <c>warehouses.assign</c>: thấy và thao tác mọi kho.</summary>
    public required bool AllWarehouses { get; init; }

    /// <summary>Kho được gán ở <c>Inventory_WarehouseKeepers</c> (khi không thấy mọi kho).</summary>
    public required IReadOnlySet<Guid> AssignedWarehouseIds { get; init; }

    public bool Can(string permission) => Access.HasPermission(permission);

    public bool InScope(Guid warehouseId) => AllWarehouses || AssignedWarehouseIds.Contains(warehouseId);

    /// <summary>BR-25: xem giá vốn, giá trị.</summary>
    public bool CanViewValues => Can(Constants.ProjectPermissions.StockValues.View);
}

/// <summary>Phạm vi kho của người gọi (BR-23).</summary>
public interface IWarehouseScope
{
    Task<InventoryActor> GetActorAsync(CancellationToken ct = default);

    /// <summary>Kho trong phạm vi (cả kho ngừng), theo thứ tự hiển thị.</summary>
    Task<IReadOnlyList<WarehouseOption>> GetWarehousesAsync(CancellationToken ct = default);
}

/// <summary>Mã chứng từ <c>PN/PX/PC + yyMMdd + 3 số</c>, <c>KK + yyMMdd + 2 số</c> (SRS §5.3, 07 §3.12).</summary>
public interface IDocumentCodeGenerator
{
    Task<string> NextAsync(string prefix, DateTime atUtc, CancellationToken ct = default);
}

/// <summary>
/// Lõi ghi sổ (BR-11): một chỗ duy nhất đổi tồn. Nạp các dòng tồn cần dùng vào <see cref="StockBook"/>, áp
/// <see cref="StockPosting"/>, thêm dòng thẻ kho và dòng tồn mới vào DB (chưa lưu; nơi gọi lưu trong transaction).
/// Dùng chung cho duyệt phiếu và nạp dữ liệu mẫu.
/// </summary>
public interface IStockPostingService
{
    Task<StockBook> LoadBookAsync(IEnumerable<(Guid WarehouseId, Guid ProductId)> keys, CancellationToken ct = default);

    /// <summary>Sổ trên các dòng tồn đã có trong bộ nhớ (seeder); dòng mới được thêm vào DB.</summary>
    StockBook CreateBook(IEnumerable<StockLevel> levels);

    Task PostReceiptAsync(StockBook book, GoodsReceipt doc, DateTime at, string description, CancellationToken ct = default);

    Task PostIssueAsync(StockBook book, GoodsIssue doc, DateTime at, string description, CancellationToken ct = default);

    Task PostTransferOutAsync(StockBook book, Transfer doc, DateTime at, string description, CancellationToken ct = default);

    Task PostTransferInAsync(StockBook book, Transfer doc, DateTime at, string description, CancellationToken ct = default);

    Task PostStocktakeAsync(StockBook book, Stocktake doc, DateTime at, CancellationToken ct = default);
}

/// <summary>Khóa kiểm kê đang mở chặn mặt hàng (BR-14).</summary>
public sealed record StocktakeLock(Guid StocktakeId, string Code, IReadOnlyList<Guid> ProductIds);

/// <summary>Giữ chỗ, khả dụng, khóa kiểm kê (07 §3.6, §3.7).</summary>
public interface IStockQueries
{
    /// <summary>Σ baseQuantity của phiếu xuất Chờ duyệt tại kho + phiếu chuyển Chờ duyệt có kho đi là kho, theo mặt hàng.</summary>
    Task<Dictionary<Guid, int>> ReservedAsync(Guid warehouseId, IReadOnlyCollection<Guid>? productIds = null, CancellationToken ct = default);

    /// <summary>Giữ chỗ của mọi kho: khóa (kho, hàng).</summary>
    Task<Dictionary<(Guid WarehouseId, Guid ProductId), int>> ReservedAllAsync(CancellationToken ct = default);

    /// <summary>Phiếu kiểm kê Đang kiểm/Chờ duyệt của kho khóa ít nhất một mặt hàng trong danh sách; null nếu không.</summary>
    Task<StocktakeLock?> FindLockAsync(Guid warehouseId, IReadOnlyCollection<Guid> productIds, CancellationToken ct = default);
}

public interface IWarehouseService
{
    Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<WarehouseOption>> GetMyAsync(CancellationToken ct = default);
    /// <summary>Mọi kho đang hoạt động (mã, tên), không theo phạm vi: ô "Kho đến" của phiếu chuyển (UC-06, 07 §5 #46).</summary>
    Task<IReadOnlyList<WarehouseOption>> GetOptionsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<KeeperCandidate>> GetKeeperCandidatesAsync(CancellationToken ct = default);
    Task<WarehouseDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<WarehouseDto> CreateAsync(SaveWarehouseRequest request, CancellationToken ct = default);
    Task<WarehouseDto> UpdateAsync(Guid id, SaveWarehouseRequest request, CancellationToken ct = default);
    Task<WarehouseDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default);
    Task<WarehouseDto> AssignKeepersAsync(Guid id, AssignKeepersRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ISupplierService
{
    Task<PaginatedResult<SupplierDto>> GetPagedAsync(SupplierQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<SupplierOption>> GetOptionsAsync(CancellationToken ct = default);
    Task<SupplierDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct = default);
    Task<SupplierDto> UpdateAsync(Guid id, SaveSupplierRequest request, CancellationToken ct = default);
    Task<SupplierDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IProductGroupService
{
    Task<IReadOnlyList<ProductGroupDto>> GetAllAsync(CancellationToken ct = default);
    Task<ProductGroupDto> CreateAsync(SaveProductGroupRequest request, CancellationToken ct = default);
    Task<ProductGroupDto> UpdateAsync(Guid id, SaveProductGroupRequest request, CancellationToken ct = default);
    Task<ProductGroupDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IProductService
{
    Task<PaginatedResult<ProductDto>> GetPagedAsync(ProductQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<CatalogProduct>> GetCatalogAsync(CancellationToken ct = default);
    Task<BarcodeMatch> FindByBarcodeAsync(string barcode, CancellationToken ct = default);
    Task<ProductDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<ProductDetailDto> CreateAsync(SaveProductRequest request, CancellationToken ct = default);
    Task<ProductDetailDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken ct = default);
    Task<ProductDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Kết quả thao tác tạo (phiếu ngược trả Id phiếu mới): <c>Created = false</c> khi gửi lại cùng <c>clientRequestId</c> (trả 200 thay vì 201).</summary>
public sealed record CreateResult<T>(T Value, bool Created);

public interface IGoodsReceiptService
{
    Task<PaginatedResult<GoodsReceiptListItem>> GetPagedAsync(GoodsReceiptQuery query, CancellationToken ct = default);
    Task<GoodsReceiptDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CreateResult<GoodsReceiptDto>> CreateAsync(SaveGoodsReceiptRequest request, CancellationToken ct = default);
    Task<GoodsReceiptDto> UpdateAsync(Guid id, SaveGoodsReceiptRequest request, CancellationToken ct = default);
    Task<GoodsReceiptDto> SubmitAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<GoodsReceiptDto> WithdrawAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<GoodsReceiptDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<GoodsReceiptDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default);
    Task<GoodsReceiptDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<CreateResult<Guid>> ReverseAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
}

public interface IGoodsIssueService
{
    Task<PaginatedResult<GoodsIssueListItem>> GetPagedAsync(GoodsIssueQuery query, CancellationToken ct = default);
    Task<GoodsIssueDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CreateResult<GoodsIssueDto>> CreateAsync(SaveGoodsIssueRequest request, CancellationToken ct = default);
    Task<GoodsIssueDto> UpdateAsync(Guid id, SaveGoodsIssueRequest request, CancellationToken ct = default);
    Task<GoodsIssueDto> SubmitAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<GoodsIssueDto> WithdrawAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<GoodsIssueDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<GoodsIssueDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default);
    Task<GoodsIssueDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<CreateResult<Guid>> ReverseAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
}

public interface ITransferService
{
    Task<PaginatedResult<TransferListItem>> GetPagedAsync(TransferQuery query, CancellationToken ct = default);
    Task<TransferDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CreateResult<TransferDto>> CreateAsync(SaveTransferRequest request, CancellationToken ct = default);
    Task<TransferDto> UpdateAsync(Guid id, SaveTransferRequest request, CancellationToken ct = default);
    Task<TransferDto> SubmitAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<TransferDto> WithdrawAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<TransferDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<TransferDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default);
    Task<TransferDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<TransferDto> ReceiveAsync(Guid id, ReceiveTransferRequest request, CancellationToken ct = default);
}

public interface IApprovalService
{
    Task<IReadOnlyList<ApprovalItem>> GetPendingAsync(ApprovalQuery query, CancellationToken ct = default);
}

public interface IStockService
{
    Task<StockListResult> GetLevelsAsync(StockQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<AvailabilityRow>> GetAvailabilityAsync(Guid warehouseId, CancellationToken ct = default);
    Task<IReadOnlyList<ReservationDto>> GetReservationsAsync(ReservationQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<StockAlertDto>> GetAlertsAsync(StockAlertQuery query, CancellationToken ct = default);
    Task<StockCardDto> GetStockCardAsync(StockCardQuery query, CancellationToken ct = default);
}

public interface IStocktakeService
{
    Task<PaginatedResult<StocktakeListItem>> GetPagedAsync(StocktakeQuery query, CancellationToken ct = default);
    Task<StocktakeDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CreateResult<StocktakeDto>> CreateAsync(CreateStocktakeRequest request, CancellationToken ct = default);
    Task<StocktakeDto> SubmitCountsAsync(Guid id, SubmitCountsRequest request, CancellationToken ct = default);
    Task<StocktakeDto> FillUncountedAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<StocktakeDto> SubmitAsync(Guid id, SubmitStocktakeRequest request, CancellationToken ct = default);
    Task<StocktakeDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
    Task<StocktakeDto> ReturnAsync(Guid id, ReturnStocktakeRequest request, CancellationToken ct = default);
    Task<StocktakeDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default);
}

public interface IInventoryReportService
{
    Task<DashboardReport> GetDashboardAsync(CancellationToken ct = default);
    Task<StaffTodo> GetStaffTodoAsync(CancellationToken ct = default);
    Task<MovementReport> GetMovementAsync(MovementQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<SlowMovingRow>> GetSlowMovingAsync(SlowMovingQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<SupplierReceiptRow>> GetReceiptsBySupplierAsync(ReportPeriodQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<IssueTypeRow>> GetIssuesByTypeAsync(ReportPeriodQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<StocktakeVarianceRow>> GetStocktakeVariancesAsync(ReportPeriodQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<TransferLossRow>> GetTransferLossesAsync(TransferLossQuery query, CancellationToken ct = default);
    Task<StoreProfile> GetStoreProfileAsync(CancellationToken ct = default);
}
