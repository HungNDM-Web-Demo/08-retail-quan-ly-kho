using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Enums.Inventory;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Inventory;

/// <summary>Nạp seed bằng chính hàm ghi sổ cho đúng số đối chiếu 06 §5.6, §5.7.</summary>
public class SeedTests
{
    [Fact]
    public async Task Seed_MatchesReferenceCounts()
    {
        await using var host = await KhoTestHost.StartAsync();

        Assert.Equal(3, await host.QueryAsync<Warehouse, int>(q => q.CountAsync()));
        Assert.Equal(15, await host.QueryAsync<Domain.Entities.Inventory.Suppliers.Supplier, int>(q => q.CountAsync()));
        Assert.Equal(10, await host.QueryAsync<ProductGroup, int>(q => q.CountAsync()));
        Assert.Equal(200, await host.QueryAsync<Product, int>(q => q.CountAsync()));
        Assert.Equal(220, await host.QueryAsync<ProductUnit, int>(q => q.CountAsync()));
        Assert.Equal(455, await host.QueryAsync<StockLevel, int>(q => q.CountAsync()));
        Assert.Equal(159, await host.QueryAsync<GoodsReceipt, int>(q => q.CountAsync()));
        Assert.Equal(398, await host.QueryAsync<GoodsIssue, int>(q => q.CountAsync()));
        Assert.Equal(46, await host.QueryAsync<Transfer, int>(q => q.CountAsync()));
        Assert.Equal(3, await host.QueryAsync<Stocktake, int>(q => q.CountAsync()));
        Assert.Equal(298, await host.QueryAsync<StocktakeLine, int>(q => q.CountAsync()));
        Assert.Equal(767, await host.QueryAsync<GoodsReceiptLine, int>(q => q.CountAsync()));
        Assert.Equal(2142, await host.QueryAsync<GoodsIssueLine, int>(q => q.CountAsync()));
        Assert.Equal(300, await host.QueryAsync<TransferLine, int>(q => q.CountAsync()));
        Assert.Equal(3484, await host.QueryAsync<StockLedgerEntry, int>(q => q.CountAsync()));

        Assert.Equal(153, await host.QueryAsync<GoodsReceipt, int>(q => q.CountAsync(x => x.Status == DocStatus.DaDuyet)));
        Assert.Equal(391, await host.QueryAsync<GoodsIssue, int>(q => q.CountAsync(x => x.Status == DocStatus.DaDuyet)));
        Assert.Equal(43, await host.QueryAsync<Transfer, int>(q => q.CountAsync(x => x.Status == TransferStatus.DaNhan)));
        Assert.Equal(2, await host.QueryAsync<Transfer, int>(q => q.CountAsync(x => x.Status == TransferStatus.DangChuyen)));
        Assert.Equal(2, await host.QueryAsync<GoodsReceipt, int>(q => q.CountAsync(x => x.Status == DocStatus.Nhap)) +
            await host.QueryAsync<GoodsIssue, int>(q => q.CountAsync(x => x.Status == DocStatus.Nhap)));
        Assert.Equal(1, await host.QueryAsync<GoodsIssue, int>(q => q.CountAsync(x => x.Status == DocStatus.TuChoi)));
    }

    [Fact]
    public async Task Seed_DashboardMatchesReferenceValues()
    {
        await using var host = await KhoTestHost.StartAsync();
        await host.SignInAsync("quanly");
        var dashboard = await host.CallAsync<IInventoryReportService, DashboardReport>(s => s.GetDashboardAsync());

        Assert.Equal(2_887_274_440m, dashboard.Warehouses.Single(w => w.Code == "KTONG").StockValue);
        Assert.Equal(781_388_179m, dashboard.Warehouses.Single(w => w.Code == "KTD").StockValue);
        Assert.Equal(706_725_408m, dashboard.Warehouses.Single(w => w.Code == "KBH").StockValue);
        Assert.Equal(4_375_388_027m, dashboard.TotalStockValue);
        Assert.Equal(6, dashboard.Pending.Total);
        Assert.Equal(3, dashboard.Pending.GoodsReceipts);
        Assert.Equal(2, dashboard.Pending.GoodsIssues);
        Assert.Equal(1, dashboard.Pending.Transfers);
        Assert.Equal(2, dashboard.InTransit.Count);
        Assert.Equal(8_816_676m, dashboard.InTransit.Value);
        Assert.Equal(1, dashboard.InTransit.LateCount);
        Assert.Equal(10, dashboard.BelowMinCount);
        Assert.Equal(4, dashboard.OutOfStockCount);
        Assert.Equal(8, dashboard.OverMaxCount);
        Assert.Equal(822_047_081m, dashboard.Daily.Sum(d => d.InValue));
        Assert.Equal(930_333_364m, dashboard.Daily.Sum(d => d.OutValue));
        Assert.Equal(30, dashboard.Daily.Count);
        Assert.Equal("KDR-180", dashboard.TopIssued[0].Code);
        Assert.Equal(57_825_960m, dashboard.TopIssued[0].Value);

        var slow = await host.CallAsync<IInventoryReportService, IReadOnlyList<SlowMovingRow>>(s => s.GetSlowMovingAsync(new SlowMovingQuery()));
        Assert.Equal(50, slow.Count);
        Assert.Equal(35, slow.Count(r => r.Bucket == SlowMovingBucket.Tu30));
        Assert.Equal(11, slow.Count(r => r.Bucket == SlowMovingBucket.Tu60));
        Assert.Equal(4, slow.Count(r => r.Bucket == SlowMovingBucket.Tu90));
        var nrc = slow.Single(r => r.ProductCode == "NRC-36" && r.WarehouseCode == "KBH");
        Assert.Equal(75, nrc.DaysSince);
        Assert.Equal(SlowMovingBucket.Tu60, nrc.Bucket);
        Assert.Equal(48, nrc.OnHand);
        Assert.Equal(4_080_000m, nrc.StockValue);
    }
}
