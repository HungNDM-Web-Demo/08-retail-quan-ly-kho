using System.Reflection;
using Application.Common.Exceptions;
using Application.Constants;
using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Stock;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Inventory;

/// <summary>Phạm vi kho (BR-23, TC-04, TC-06), giá trị theo quyền (BR-25), báo cáo, thẻ kho (TC-23, TC-33), NFR-05, quyền.</summary>
public class ScopeReportTests
{
    [Fact]
    public async Task Tc06_KeeperSeesOnlyAssignedWarehouses()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var mine = await s.As<IWarehouseService, IReadOnlyList<WarehouseOption>>("nhanvien", x => x.GetMyAsync());
        Assert.Equal(["KTONG", "KTD"], mine.Select(w => w.Code));
        var all = await s.As<IWarehouseService, IReadOnlyList<WarehouseOption>>("quanly", x => x.GetMyAsync());
        Assert.Equal(3, all.Count);

        var kbh = await s.Warehouse("KBH");
        var kbhReceipt = await host.QueryAsync<GoodsReceipt, Guid>(q => q.Where(r => r.WarehouseId == kbh).Select(r => r.Id).FirstAsync());
        var forbidden = await Assert.ThrowsAsync<CodedForbiddenException>(() => s.As<IGoodsReceiptService, GoodsReceiptDto>("nhanvien", x => x.GetAsync(kbhReceipt)));
        Assert.Equal("Bạn không phụ trách kho KBH", forbidden.Message);

        var list = await s.As<IGoodsReceiptService, Application.Common.Models.PaginatedResult<GoodsReceiptListItem>>("nhanvien",
            x => x.GetPagedAsync(new GoodsReceiptQuery { WarehouseId = kbh, PageSize = 100 }));
        Assert.DoesNotContain(list.Items, r => r.WarehouseCode == "KBH");

        var ntlId = await s.Product("NTL-330");
        var card = await s.As<IStockService, StockCardDto>("nhanvien", x => x.GetStockCardAsync(new StockCardQuery
        {
            ProductId = ntlId, WarehouseId = kbh, From = "2026-07-01", To = "2026-10-15"
        }));
        Assert.Null(card.WarehouseId);
        Assert.DoesNotContain(card.Lines, l => l.WarehouseCode == "KBH");
        Assert.False(card.CanViewValues);
        Assert.All(card.Lines, l => Assert.Null(l.InValue));

        // TC-22: thủ kho không thấy giá vốn, giá trị.
        var stock = await s.As<IStockService, StockListResult>("nhanvien", x => x.GetLevelsAsync(new StockQuery()));
        Assert.False(stock.CanViewValues);
        Assert.Null(stock.TotalValue);
        Assert.All(stock.Items, r => Assert.Null(r.StockValue));
    }

    /// <summary>
    /// 07 §5 #46: thủ kho chọn được kho đến không phụ trách (UC-06 "kho đi lập, kho đến nhận"); Việc cần làm ghi đủ mã
    /// kho đến dù kho đó ngoài phạm vi (lỗi cũ: "Chuyển kho KTONG → ").
    /// </summary>
    [Fact]
    public async Task KeeperTransfersToUnassignedWarehouse_OptionsAndTodoShowDestination()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var options = await s.As<IWarehouseService, IReadOnlyList<WarehouseOption>>("nhanvien", x => x.GetOptionsAsync());
        Assert.Equal(["KTONG", "KTD", "KBH"], options.Select(w => w.Code));

        var transfer = await s.CreateTransferAsync("nhanvien", "KTONG", "KBH", submit: true, ("NTL-330", 24, 1));
        var todo = await s.As<IInventoryReportService, StaffTodo>("nhanvien", x => x.GetStaffTodoAsync());
        var waiting = todo.Waiting.Single(d => d.Id == transfer.Id);
        Assert.Equal("Chuyển kho KTONG → KBH", waiting.TypeText);
        Assert.Equal(("KTONG", "KBH"), (waiting.WarehouseCode, waiting.ToWarehouseCode));
    }

    [Fact]
    public async Task Tc23_Tc33_StockCardAndMovementForToday()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var receipt = await s.CreateReceiptAsync("nhanvien", "KTONG", "NCC001", submit: true, 0, ("NTL-330", 24, 100, 180_000));
        await s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.ApproveAsync(receipt.Id, KhoScenario.Act(receipt.Version)));
        host.Time.Advance(TimeSpan.FromMinutes(5));
        var transfer = await s.CreateTransferAsync("nhanvien", "KTONG", "KTD", submit: true, ("NTL-330", 24, 20));
        await s.As<ITransferService, TransferDto>("quanly", x => x.ApproveAsync(transfer.Id, KhoScenario.Act(transfer.Version)));

        var ktong = await s.Warehouse("KTONG");
        var ntlId = await s.Product("NTL-330");
        var card = await s.As<IStockService, StockCardDto>("quanly", x => x.GetStockCardAsync(new StockCardQuery
        {
            ProductId = ntlId, WarehouseId = ktong, From = "2026-10-15", To = "2026-10-15"
        }));
        Assert.Equal(2400, card.Opening.Quantity);
        Assert.Equal([(2400, 0, 4800), (0, 480, 4320)], card.Lines.Select(l => (l.InQuantity, l.OutQuantity, l.BalanceQuantity)));
        Assert.Equal((7350m, 3_528_000m), (card.Lines[1].UnitCost!.Value, card.Lines[1].OutValue!.Value));
        Assert.Equal(4320, card.Closing.Quantity);
        Assert.Equal(4320, (await s.Level("KTONG", "NTL-330")).OnHand);

        var movement = await s.As<IInventoryReportService, MovementReport>("quanly",
            x => x.GetMovementAsync(new MovementQuery { From = "2026-10-15", To = "2026-10-15", WarehouseId = ktong }));
        var row = movement.Rows.Single(r => r.ProductCode == "NTL-330");
        Assert.Equal((2400, 17_280_000m), (row.OpeningQty, row.OpeningValue));
        Assert.Equal((2400, 18_000_000m), (row.InQty, row.InValue));
        Assert.Equal((480, 3_528_000m), (row.OutQty, row.OutValue));
        Assert.Equal((4320, 31_752_000m), (row.ClosingQty, row.ClosingValue));
        Assert.Null(movement.InTransit);

        // TC-31: biểu đồ nhập hôm nay tăng đúng 18.000.000.
        var dashboard = await s.As<IInventoryReportService, DashboardReport>("quanly", x => x.GetDashboardAsync());
        Assert.Equal(18_000_000m, dashboard.Daily[^1].InValue);
    }

    [Fact]
    public async Task Nfr05_MovementClosingEqualsLevelsAndLedger()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var movement = await s.As<IInventoryReportService, MovementReport>("quanly",
            x => x.GetMovementAsync(new MovementQuery { From = "2026-07-01", To = "2026-10-15" }));
        var levels = await host.QueryAsync<StockLevel, List<StockLevel>>(q => q.ToListAsync());
        var ledger = await host.QueryAsync<StockLedgerEntry, List<StockLedgerEntry>>(q => q.ToListAsync());

        foreach (var row in movement.Rows)
        {
            var productLevels = levels.Where(l => l.ProductId == row.ProductId).ToList();
            Assert.Equal(productLevels.Sum(l => l.OnHand), row.ClosingQty);
            Assert.Equal(productLevels.Sum(l => l.StockValue), row.ClosingValue);
            var lastBalances = ledger.Where(e => e.ProductId == row.ProductId).GroupBy(e => e.WarehouseId)
                .Select(g => g.OrderBy(e => e.PostedAt).ThenBy(e => e.DocCode, StringComparer.Ordinal).ThenBy(e => e.Seq).Last()).ToList();
            Assert.Equal(lastBalances.Sum(e => e.BalanceQuantity), row.ClosingQty);
            Assert.Equal(lastBalances.Sum(e => e.BalanceValue), row.ClosingValue);
        }

        Assert.Equal(4_375_388_027m, movement.Totals.ClosingValue);
        Assert.Equal(8_816_676m, movement.InTransit!.TotalValue);
        foreach (var level in levels)
            Assert.True(level.OnHand > 0 || level.StockValue == 0);
    }

    [Fact]
    public async Task Reports_PeriodBreakdowns()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var period = new ReportPeriodQuery { From = "2026-07-01", To = "2026-10-15" };
        var bySupplier = await s.As<IInventoryReportService, IReadOnlyList<SupplierReceiptRow>>("quanly", x => x.GetReceiptsBySupplierAsync(period));
        Assert.NotEmpty(bySupplier);
        var byType = await s.As<IInventoryReportService, IReadOnlyList<IssueTypeRow>>("quanly", x => x.GetIssuesByTypeAsync(period));
        Assert.Equal(5, byType.Count);
        Assert.Equal(391, byType.Sum(r => r.DocCount));
        var variances = await s.As<IInventoryReportService, IReadOnlyList<StocktakeVarianceRow>>("quanly", x => x.GetStocktakeVariancesAsync(period));
        Assert.Equal([8, 5, 8], variances.Select(v => v.VarianceLineCount));
        var losses = await s.As<IInventoryReportService, IReadOnlyList<TransferLossRow>>("quanly",
            x => x.GetTransferLossesAsync(new TransferLossQuery { From = "2026-07-01", To = "2026-10-15" }));
        Assert.Equal(706_805m, losses.Sum(r => r.ShortageValue));
        Assert.Equal(6, losses.Sum(r => r.Transfers.Count));

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => s.As<IInventoryReportService, IReadOnlyList<IssueTypeRow>>("quanly",
            x => x.GetIssuesByTypeAsync(new ReportPeriodQuery { From = "2025-01-01", To = "2026-10-15" })));
        var store = await s.As<IInventoryReportService, StoreProfile>("nhanvien", x => x.GetStoreProfileAsync());
        Assert.Equal("Công ty TNHH Phân phối Tân Lộc Phát", store.Name);
    }

    [Fact]
    public void ProjectPermissions_AreDeclaredInSeed_AndGrantedLikeContract()
    {
        var seeded = SystemSeedData.Embedded.Permissions.Select(p => p.Code).ToHashSet();
        var codes = typeof(ProjectPermissions).GetNestedTypes(BindingFlags.Public | BindingFlags.Static)
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
            .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToList();
        Assert.Equal(39, codes.Count);
        Assert.All(codes, c => Assert.Contains(c, seeded));
    }

    [Fact]
    public async Task Staff_HasNoApproveOrValuePermission()
    {
        await using var host = await KhoTestHost.StartAsync();
        var actor = await new KhoScenario(host).As<IWarehouseScope, InventoryActor>("nhanvien", x => x.GetActorAsync());
        Assert.False(actor.Can(ProjectPermissions.GoodsReceipts.Approve));
        Assert.False(actor.CanViewValues);
        Assert.False(actor.AllWarehouses);
        var manager = await new KhoScenario(host).As<IWarehouseScope, InventoryActor>("quanly", x => x.GetActorAsync());
        Assert.True(manager.Can(ProjectPermissions.Stocktakes.Approve));
        Assert.True(manager.AllWarehouses);
    }
}
