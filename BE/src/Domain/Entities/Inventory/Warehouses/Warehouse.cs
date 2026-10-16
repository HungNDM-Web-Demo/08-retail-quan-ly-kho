using Domain.Base;

namespace Domain.Entities.Inventory.Warehouses;

/// <summary>Kho (06 §4 <c>Inventory_Warehouses</c>). Thủ kho phụ trách ở <see cref="Keepers"/>.</summary>
public class Warehouse : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public List<WarehouseKeeper> Keepers { get; set; } = [];
}

/// <summary>Thủ kho phụ trách kho (bảng nối thuần, khóa ghép <c>(WarehouseId, UserId)</c>; BR-23).</summary>
public class WarehouseKeeper
{
    public Guid WarehouseId { get; set; }
    public Guid UserId { get; set; }
}
