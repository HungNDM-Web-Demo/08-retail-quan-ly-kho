using Domain.Entities.Inventory.Documents;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Inventory;

/// <summary>Cột chung của phiếu nhập, xuất, chuyển (06 §4).</summary>
internal static class DocumentColumns
{
    public static void Configure<T>(EntityTypeBuilder<T> builder)
        where T : InventoryDocument
    {
        builder.Property(x => x.Code).HasMaxLength(20);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.Property(x => x.CreatedByName).HasMaxLength(150).IsRequired();
        builder.Property(x => x.ApprovedByName).HasMaxLength(150);
        builder.Property(x => x.RejectedByName).HasMaxLength(150);
        builder.Property(x => x.RejectReason).HasMaxLength(500);
        builder.Property(x => x.CancelledByName).HasMaxLength(150);
        builder.Property(x => x.ClientRequestId).HasMaxLength(64);
        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.Property(x => x.LastRequestId).HasMaxLength(64);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.HasIndex(x => x.ApprovedAt);
    }

    public static void Line<T>(EntityTypeBuilder<T> builder)
        where T : DocLine
    {
        // Id sinh ở code: dòng thêm vào phiếu đang theo dõi phải được coi là bản ghi mới (Added), không phải UPDATE.
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ProductCode).HasMaxLength(20).IsRequired();
        builder.Property(x => x.ProductName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.BaseUnit).HasMaxLength(20).IsRequired();
        builder.Property(x => x.UnitName).HasMaxLength(30).IsRequired();
        builder.HasIndex(x => x.ProductId);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ProductUnit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class GoodsReceiptConfiguration : IEntityTypeConfiguration<GoodsReceipt>
{
    public void Configure(EntityTypeBuilder<GoodsReceipt> builder)
    {
        builder.ToTable("Inventory_GoodsReceipts");
        DocumentColumns.Configure(builder);
        builder.Property(x => x.DelivererName).HasMaxLength(150);
        builder.Property(x => x.SourceDocNo).HasMaxLength(30);
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.FreightCost).HasPrecision(18, 2);
        builder.Property(x => x.TotalAmount).HasPrecision(18, 2);
        builder.Property(x => x.TotalValue).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.WarehouseId, x.Status });
        builder.HasIndex(x => new { x.Status, x.SubmittedAt });
        builder.HasIndex(x => x.ReversalOfIssueId);
        builder.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Supplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<GoodsIssue>().WithMany().HasForeignKey(x => x.ReversalOfIssueId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.ReceiptId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class GoodsReceiptLineConfiguration : IEntityTypeConfiguration<GoodsReceiptLine>
{
    public void Configure(EntityTypeBuilder<GoodsReceiptLine> builder)
    {
        builder.ToTable("Inventory_GoodsReceiptLines");
        DocumentColumns.Line(builder);
        builder.HasIndex(x => new { x.ReceiptId, x.LineNo });
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.AllocatedCost).HasPrecision(18, 2);
        builder.Property(x => x.Value).HasPrecision(18, 2);
    }
}

public sealed class GoodsIssueConfiguration : IEntityTypeConfiguration<GoodsIssue>
{
    public void Configure(EntityTypeBuilder<GoodsIssue> builder)
    {
        builder.ToTable("Inventory_GoodsIssues");
        DocumentColumns.Configure(builder);
        builder.Property(x => x.RecipientName).HasMaxLength(150);
        builder.Property(x => x.OrderRef).HasMaxLength(30);
        builder.Property(x => x.Reason).HasMaxLength(300);
        builder.Property(x => x.TotalValue).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.WarehouseId, x.Status });
        builder.HasIndex(x => new { x.Status, x.SubmittedAt });
        builder.HasIndex(x => x.ReversalOfReceiptId);
        builder.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Supplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<GoodsReceipt>().WithMany().HasForeignKey(x => x.ReversalOfReceiptId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.IssueId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class GoodsIssueLineConfiguration : IEntityTypeConfiguration<GoodsIssueLine>
{
    public void Configure(EntityTypeBuilder<GoodsIssueLine> builder)
    {
        builder.ToTable("Inventory_GoodsIssueLines");
        DocumentColumns.Line(builder);
        builder.HasIndex(x => new { x.IssueId, x.LineNo });
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);
        builder.Property(x => x.Value).HasPrecision(18, 2);
    }
}

public sealed class TransferConfiguration : IEntityTypeConfiguration<Transfer>
{
    public void Configure(EntityTypeBuilder<Transfer> builder)
    {
        builder.ToTable("Inventory_Transfers");
        DocumentColumns.Configure(builder);
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.ReceivedByName).HasMaxLength(150);
        builder.Property(x => x.TotalValue).HasPrecision(18, 2);
        builder.Property(x => x.ShortageValue).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.FromWarehouseId, x.Status });
        builder.HasIndex(x => new { x.ToWarehouseId, x.Status });
        builder.HasIndex(x => new { x.Status, x.ApprovedAt });
        builder.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.FromWarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.ToWarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.TransferId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TransferLineConfiguration : IEntityTypeConfiguration<TransferLine>
{
    public void Configure(EntityTypeBuilder<TransferLine> builder)
    {
        builder.ToTable("Inventory_TransferLines");
        DocumentColumns.Line(builder);
        builder.HasIndex(x => new { x.TransferId, x.LineNo });
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);
        builder.Property(x => x.Value).HasPrecision(18, 2);
        builder.Property(x => x.ShortageValue).HasPrecision(18, 2);
    }
}

public sealed class StocktakeConfiguration : IEntityTypeConfiguration<Stocktake>
{
    public void Configure(EntityTypeBuilder<Stocktake> builder)
    {
        builder.ToTable("Inventory_Stocktakes");
        builder.Property(x => x.Code).HasMaxLength(20).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => new { x.WarehouseId, x.Status });
        builder.Property(x => x.CreatedByName).HasMaxLength(150).IsRequired();
        builder.Property(x => x.CounterName).HasMaxLength(150).IsRequired();
        builder.Property(x => x.SubmittedByName).HasMaxLength(150);
        builder.Property(x => x.ApprovedByName).HasMaxLength(150);
        builder.Property(x => x.CancelledByName).HasMaxLength(150);
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.ReturnNote).HasMaxLength(500);
        builder.Property(x => x.SurplusValue).HasPrecision(18, 2);
        builder.Property(x => x.ShortageValue).HasPrecision(18, 2);
        builder.Property(x => x.ClientRequestId).HasMaxLength(64);
        builder.HasIndex(x => x.ClientRequestId).IsUnique();
        builder.Property(x => x.LastRequestId).HasMaxLength(64);
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.CounterId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.StocktakeId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(x => x.Counts).WithOne().HasForeignKey(x => x.StocktakeId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class StocktakeLineConfiguration : IEntityTypeConfiguration<StocktakeLine>
{
    public void Configure(EntityTypeBuilder<StocktakeLine> builder)
    {
        builder.ToTable("Inventory_StocktakeLines");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.HasIndex(x => new { x.StocktakeId, x.ProductId }).IsUnique();
        builder.Property(x => x.ProductCode).HasMaxLength(20).IsRequired();
        builder.Property(x => x.ProductName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.GroupName).HasMaxLength(100).IsRequired();
        builder.Property(x => x.BaseUnit).HasMaxLength(20).IsRequired();
        builder.Property(x => x.BookCost).HasPrecision(18, 2);
        builder.Property(x => x.DifferenceValue).HasPrecision(18, 2);
        builder.Property(x => x.ReasonNote).HasMaxLength(300);
        builder.Property(x => x.RecountNote).HasMaxLength(300);
        builder.Property(x => x.LastCountedByName).HasMaxLength(150);
        builder.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StocktakeCountConfiguration : IEntityTypeConfiguration<StocktakeCount>
{
    public void Configure(EntityTypeBuilder<StocktakeCount> builder)
    {
        builder.ToTable("Inventory_StocktakeCounts");
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ClientRequestId).HasMaxLength(64).IsRequired();
        builder.Property(x => x.CountedByName).HasMaxLength(150).IsRequired();
        builder.HasIndex(x => new { x.StocktakeId, x.ClientRequestId }).IsUnique();
    }
}
