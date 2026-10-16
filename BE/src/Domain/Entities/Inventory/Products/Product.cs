using Domain.Base;

namespace Domain.Entities.Inventory.Products;

/// <summary>Nhóm hàng (06 §4 <c>Inventory_ProductGroups</c>).</summary>
public class ProductGroup : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#475569";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }
}

/// <summary>Mặt hàng (06 §4 <c>Inventory_Products</c>); số lượng mọi nơi theo <see cref="BaseUnit"/> (BR-01).</summary>
public class Product : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    /// <summary>Chữ thường không dấu của mã, tên, mọi mã vạch (FR-09), cập nhật mỗi lần lưu.</summary>
    public string SearchText { get; set; } = string.Empty;

    public Guid GroupId { get; set; }
    public ProductGroup? Group { get; set; }
    public string BaseUnit { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? Spec { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    /// <summary>Tối đa 2 đơn vị quy đổi (FR-07), theo <see cref="ProductUnit.SortOrder"/>.</summary>
    public List<ProductUnit> Units { get; set; } = [];

    public void RefreshSearchText() =>
        SearchText = TextSearch.Normalize(string.Join(' ', new[] { Code, Name, Barcode }
            .Concat(Units.Select(u => u.Barcode))
            .Where(s => !string.IsNullOrWhiteSpace(s))));
}

/// <summary>Đơn vị quy đổi (06 §4 <c>Inventory_ProductUnits</c>): <see cref="Factor"/> đơn vị cơ bản (2–10.000).</summary>
public class ProductUnit : BaseEntity, ICreationTracked, IModificationTracked
{
    public Guid ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Factor { get; set; }
    public string? Barcode { get; set; }
    public int SortOrder { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
