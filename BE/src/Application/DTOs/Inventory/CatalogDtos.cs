using Application.Common.Models;
using Domain.Enums.Inventory;

namespace Application.DTOs.Inventory;

// Kho, nhà cung cấp, nhóm hàng, mặt hàng (07 §2.1–2.3).

public sealed class WarehouseDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Address { get; init; }
    public string? Phone { get; init; }
    public bool IsActive { get; init; }
    public int SortOrder { get; init; }
    public IReadOnlyList<UserRef> Keepers { get; init; } = [];
    public int StockedProductCount { get; init; }
    public decimal? StockValue { get; init; }
    public int OpenDocumentCount { get; init; }
    public bool HasDocuments { get; init; }
}

public sealed class SaveWarehouseRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
}

public sealed class AssignKeepersRequest
{
    public List<Guid> UserIds { get; set; } = [];
}

public sealed record KeeperCandidate(Guid Id, string Username, string FullName, IReadOnlyList<string> WarehouseCodes);

public sealed class SupplierDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? TaxCode { get; init; }
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? ContactName { get; init; }
    public bool IsActive { get; init; }
    public int ReceiptCount { get; init; }
    public DateTime? LastReceiptAt { get; init; }
    public bool HasDocuments { get; init; }
}

public sealed class SupplierQuery : PaginationQuery
{
    public bool? IsActive { get; set; }
}

public sealed record SupplierOption(Guid Id, string Code, string Name, bool IsActive);

public sealed class SaveSupplierRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? TaxCode { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? ContactName { get; set; }
}

public sealed record ProductGroupDto(Guid Id, string Code, string Name, string Color, bool IsActive, int SortOrder, int ProductCount);

public sealed class SaveProductGroupRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Color { get; set; }
}

public sealed record ProductStockCell(Guid WarehouseId, string WarehouseCode, int OnHand, StockStatus Status);

public class ProductDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public string GroupColor { get; init; } = string.Empty;
    public string BaseUnit { get; init; } = string.Empty;
    public string? Barcode { get; init; }
    public string? Spec { get; init; }
    public string? ImageUrl { get; init; }
    public bool IsActive { get; init; }
    public IReadOnlyList<ProductUnitDto> Units { get; init; } = [];
    public IReadOnlyList<ProductStockCell> Stocks { get; init; } = [];
    public int TotalOnHand { get; init; }
    public bool HasDocuments { get; init; }
}

public sealed record ProductLevelDto(Guid WarehouseId, string WarehouseCode, string WarehouseName, int? MinQty, int? MaxQty, int OnHand);

public sealed class ProductDetailDto : ProductDto
{
    public IReadOnlyList<ProductLevelDto> Levels { get; init; } = [];
}

public sealed class ProductQuery : PaginationQuery
{
    public Guid? GroupId { get; set; }
    public bool? IsActive { get; set; }
}

public sealed class SaveProductUnitInput
{
    public Guid? Id { get; set; }
    public string? Name { get; set; }
    public int Factor { get; set; }
    public string? Barcode { get; set; }
}

public sealed class SaveProductLevelInput
{
    public Guid WarehouseId { get; set; }
    public int? MinQty { get; set; }
    public int? MaxQty { get; set; }
}

public sealed class SaveProductRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public Guid GroupId { get; set; }
    public string? BaseUnit { get; set; }
    public string? Barcode { get; set; }
    public string? Spec { get; set; }
    public List<SaveProductUnitInput> Units { get; set; } = [];
    public List<SaveProductLevelInput> Levels { get; set; } = [];
}

public sealed class CatalogProduct
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string BaseUnit { get; init; } = string.Empty;
    public string? Barcode { get; init; }
    public string? Spec { get; init; }
    public string? ImageUrl { get; init; }
    public bool IsActive { get; init; }
    public IReadOnlyList<CatalogUnit> Units { get; init; } = [];
}

public sealed record BarcodeMatch(CatalogProduct Product, Guid? UnitId);

/// <summary>Đơn vị in trên chứng từ (Store.*), người đăng nhập nào cũng đọc được.</summary>
public sealed record StoreProfile(
    string Name,
    string Address,
    string Phone,
    string TaxCode,
    string DirectorName,
    string ChiefAccountantName,
    string LogoUrl);
