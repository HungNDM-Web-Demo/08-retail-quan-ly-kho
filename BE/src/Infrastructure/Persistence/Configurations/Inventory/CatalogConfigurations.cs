using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Entities.System.Users;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Inventory;

public sealed class WarehouseConfiguration : IEntityTypeConfiguration<Warehouse>
{
    public void Configure(EntityTypeBuilder<Warehouse> builder)
    {
        builder.ToTable("Inventory_Warehouses");
        builder.Property(x => x.Code).HasMaxLength(10).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Address).HasMaxLength(250);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
        builder.HasMany(x => x.Keepers).WithOne().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WarehouseKeeperConfiguration : IEntityTypeConfiguration<WarehouseKeeper>
{
    public void Configure(EntityTypeBuilder<WarehouseKeeper> builder)
    {
        builder.ToTable("Inventory_WarehouseKeepers");
        builder.HasKey(x => new { x.WarehouseId, x.UserId });
        builder.HasIndex(x => x.UserId);
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("Inventory_Suppliers");
        builder.Property(x => x.Code).HasMaxLength(10).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.TaxCode).HasMaxLength(14);
        builder.Property(x => x.Phone).HasMaxLength(20);
        builder.Property(x => x.Address).HasMaxLength(250);
        builder.Property(x => x.ContactName).HasMaxLength(100);
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
    }
}

public sealed class ProductGroupConfiguration : IEntityTypeConfiguration<ProductGroup>
{
    public void Configure(EntityTypeBuilder<ProductGroup> builder)
    {
        builder.ToTable("Inventory_ProductGroups");
        builder.Property(x => x.Code).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Color).HasMaxLength(7).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
    }
}

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Inventory_Products");
        builder.Property(x => x.Code).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.SearchText).HasMaxLength(400).IsRequired();
        builder.Property(x => x.BaseUnit).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Barcode).HasMaxLength(14);
        builder.Property(x => x.Spec).HasMaxLength(100);
        builder.Property(x => x.ImageUrl).HasMaxLength(500);
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => x.Barcode).IsUnique().WhereNotDeleted();
        builder.HasIndex(x => x.GroupId);
        builder.HasOne(x => x.Group).WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Units).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProductUnitConfiguration : IEntityTypeConfiguration<ProductUnit>
{
    public void Configure(EntityTypeBuilder<ProductUnit> builder)
    {
        builder.ToTable("Inventory_ProductUnits");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Name).HasMaxLength(30).IsRequired();
        builder.Property(x => x.Barcode).HasMaxLength(14);
        builder.HasIndex(x => new { x.ProductId, x.SortOrder });
        builder.HasIndex(x => x.Barcode).IsUnique();
    }
}

public sealed class StockLevelConfiguration : IEntityTypeConfiguration<StockLevel>
{
    public void Configure(EntityTypeBuilder<StockLevel> builder)
    {
        builder.ToTable("Inventory_StockLevels");
        builder.Property(x => x.StockValue).HasPrecision(18, 2);
        builder.Property(x => x.AvgCost).HasPrecision(18, 2);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.HasIndex(x => new { x.WarehouseId, x.ProductId }).IsUnique();
        builder.HasIndex(x => x.ProductId);
        builder.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StockLedgerEntryConfiguration : IEntityTypeConfiguration<StockLedgerEntry>
{
    public void Configure(EntityTypeBuilder<StockLedgerEntry> builder)
    {
        builder.ToTable("Inventory_StockLedger");
        builder.Property(x => x.DocCode).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(300).IsRequired();
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);
        builder.Property(x => x.InValue).HasPrecision(18, 2);
        builder.Property(x => x.OutValue).HasPrecision(18, 2);
        builder.Property(x => x.BalanceValue).HasPrecision(18, 2);
        builder.Property(x => x.AvgCostAfter).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.WarehouseId, x.ProductId, x.PostedAt });
        builder.HasIndex(x => new { x.ProductId, x.PostedAt });
        builder.HasIndex(x => x.PostedAt);
        builder.HasIndex(x => x.DocId);
        builder.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}
