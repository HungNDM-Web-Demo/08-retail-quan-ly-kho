using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Microsoft.AspNetCore.Mvc;
using P = Application.Constants.ProjectPermissions;

namespace API.Controllers.Inventory;

/// <summary>Gốc của controller nghiệp vụ kho: đưa <c>code</c> của lỗi 403/404 vào ProblemDetails.</summary>
[InventoryProblem]
public abstract class InventoryControllerBase : BaseApiController
{
    /// <summary>Tạo mới trả 201; gửi lại cùng <c>clientRequestId</c> trả 200 kèm bản đã tạo (07 §3.8).</summary>
    protected IActionResult CreatedOrOk<T>(CreateResult<T> result) =>
        result.Created ? StatusCode(StatusCodes.Status201Created, result.Value) : Ok(result.Value);
}

/// <summary>Kho, thủ kho phụ trách (07 §2.1).</summary>
[Route("api/warehouses")]
public sealed class WarehousesController(IWarehouseService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Warehouses.View)]
    public Task<IReadOnlyList<WarehouseDto>> GetAll(CancellationToken ct) => service.GetAllAsync(ct);

    [HttpGet("my")]
    public Task<IReadOnlyList<WarehouseOption>> GetMy(CancellationToken ct) => service.GetMyAsync(ct);

    /// <summary>Mọi kho đang hoạt động cho ô "Kho đến" của phiếu chuyển (07 §5 #46).</summary>
    [HttpGet("options")]
    [AuthorizePermission(P.Transfers.View)]
    public Task<IReadOnlyList<WarehouseOption>> GetOptions(CancellationToken ct) => service.GetOptionsAsync(ct);

    [HttpGet("keeper-candidates")]
    [AuthorizePermission(P.Warehouses.Assign)]
    public Task<IReadOnlyList<KeeperCandidate>> GetKeeperCandidates(CancellationToken ct) => service.GetKeeperCandidatesAsync(ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Warehouses.View)]
    public Task<WarehouseDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.Warehouses.Create)]
    public async Task<IActionResult> Create(SaveWarehouseRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Warehouses.Update)]
    public Task<WarehouseDto> Update(Guid id, SaveWarehouseRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    [AuthorizePermission(P.Warehouses.Update)]
    public Task<WarehouseDto> SetStatus(Guid id, SetActiveRequest request, CancellationToken ct) => service.SetActiveAsync(id, request, ct);

    [HttpPut("{id:guid}/keepers")]
    [AuthorizePermission(P.Warehouses.Assign)]
    public Task<WarehouseDto> AssignKeepers(Guid id, AssignKeepersRequest request, CancellationToken ct) => service.AssignKeepersAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.Warehouses.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Nhà cung cấp (07 §2.2).</summary>
[Route("api/suppliers")]
public sealed class SuppliersController(ISupplierService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Suppliers.View)]
    public Task<PaginatedResult<SupplierDto>> GetPaged([FromQuery] SupplierQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("options")]
    [AuthorizePermission(P.Suppliers.View, P.GoodsReceipts.Create, P.GoodsIssues.Create)]
    public Task<IReadOnlyList<SupplierOption>> GetOptions(CancellationToken ct) => service.GetOptionsAsync(ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Suppliers.View)]
    public Task<SupplierDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.Suppliers.Create)]
    public async Task<IActionResult> Create(SaveSupplierRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Suppliers.Update)]
    public Task<SupplierDto> Update(Guid id, SaveSupplierRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    [AuthorizePermission(P.Suppliers.Update)]
    public Task<SupplierDto> SetStatus(Guid id, SetActiveRequest request, CancellationToken ct) => service.SetActiveAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.Suppliers.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Nhóm hàng (07 §2.3).</summary>
[Route("api/product-groups")]
public sealed class ProductGroupsController(IProductGroupService service) : InventoryControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<ProductGroupDto>> GetAll(CancellationToken ct) => service.GetAllAsync(ct);

    [HttpPost]
    [AuthorizePermission(P.Products.Create)]
    public async Task<IActionResult> Create(SaveProductGroupRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Products.Update)]
    public Task<ProductGroupDto> Update(Guid id, SaveProductGroupRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    [AuthorizePermission(P.Products.Update)]
    public Task<ProductGroupDto> SetStatus(Guid id, SetActiveRequest request, CancellationToken ct) => service.SetActiveAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.Products.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Mặt hàng (07 §2.3).</summary>
[Route("api/products")]
public sealed class ProductsController(IProductService service) : InventoryControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Products.View)]
    public Task<PaginatedResult<ProductDto>> GetPaged([FromQuery] ProductQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("catalog")]
    [AuthorizePermission(P.Products.View, P.GoodsReceipts.Create, P.GoodsIssues.Create, P.Transfers.Create, P.Stocktakes.Count)]
    public Task<IReadOnlyList<CatalogProduct>> GetCatalog(CancellationToken ct) => service.GetCatalogAsync(ct);

    [HttpGet("by-barcode/{barcode}")]
    [AuthorizePermission(P.Products.View, P.GoodsReceipts.Create, P.GoodsIssues.Create, P.Transfers.Create, P.Stocktakes.Count)]
    public Task<BarcodeMatch> FindByBarcode(string barcode, CancellationToken ct) => service.FindByBarcodeAsync(barcode, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Products.View)]
    public Task<ProductDetailDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.Products.Create)]
    public async Task<IActionResult> Create(SaveProductRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Products.Update)]
    public Task<ProductDetailDto> Update(Guid id, SaveProductRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    [AuthorizePermission(P.Products.Update)]
    public Task<ProductDto> SetStatus(Guid id, SetActiveRequest request, CancellationToken ct) => service.SetActiveAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.Products.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Đơn vị in trên chứng từ (07 §2.11).</summary>
[Route("api/store-profile")]
public sealed class StoreProfileController(IInventoryReportService service) : InventoryControllerBase
{
    [HttpGet]
    public Task<StoreProfile> Get(CancellationToken ct) => service.GetStoreProfileAsync(ct);
}
