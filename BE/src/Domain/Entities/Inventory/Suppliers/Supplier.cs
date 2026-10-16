using Domain.Base;

namespace Domain.Entities.Inventory.Suppliers;

/// <summary>Nhà cung cấp (06 §4 <c>Inventory_Suppliers</c>).</summary>
public class Supplier : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? TaxCode { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? ContactName { get; set; }
    public bool IsActive { get; set; } = true;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }
}
