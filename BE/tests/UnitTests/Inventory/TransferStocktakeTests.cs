using Application.Common.Exceptions;
using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Domain.Common;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Enums.Inventory;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Inventory;

/// <summary>Chuyển kho (TC-18, TC-19, TC-32, TC-34) và kiểm kê (TC-26…TC-30).</summary>
public class TransferStocktakeTests
{
    [Fact]
    public async Task Tc18_Tc19_Tc32_Tc34_TransferWithShortage()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);

        var same = new SaveTransferRequest
        {
            FromWarehouseId = await s.Warehouse("KTONG"), ToWarehouseId = await s.Warehouse("KTONG"), ClientRequestId = KhoScenario.Rid(),
            Lines = [await s.LineAsync("NTL-330", 24, 1)]
        };
        var ex = await Assert.ThrowsAsync<ValidationException>(() => s.As<ITransferService, CreateResult<TransferDto>>("nhanvien", x => x.CreateAsync(same)));
        Assert.Contains(ex.Errors, e => e.PropertyName == "toWarehouseId" && e.ErrorMessage == "Kho đến phải khác kho đi");

        var doc = await s.CreateTransferAsync("nhanvien", "KTONG", "KTD", submit: true, ("NTL-330", 24, 20));
        Assert.StartsWith("PC261015", doc.Code);
        var approved = await s.As<ITransferService, TransferDto>("quanly", x => x.ApproveAsync(doc.Id, KhoScenario.Act(doc.Version)));
        Assert.Equal(TransferStatus.DangChuyen, approved.Status);
        Assert.Equal((7200m, 3_456_000m), (approved.Lines[0].UnitCost!.Value, approved.Lines[0].Value!.Value));
        Assert.Equal(1920, (await s.Level("KTONG", "NTL-330")).OnHand);
        Assert.Equal(90, (await s.Level("KTD", "NTL-330")).OnHand);

        // TC-32: Việc cần làm của thủ kho có 1 phiếu chờ nhận tại KTD.
        var todo = await s.As<IInventoryReportService, StaffTodo>("nhanvien", x => x.GetStaffTodoAsync());
        Assert.Single(todo.ToReceive);
        Assert.Equal("KTD", todo.ToReceive[0].WarehouseCode);

        // TC-34: Tất cả kho, hôm nay.
        var today = "2026-10-15";
        var movement = await s.As<IInventoryReportService, MovementReport>("quanly", x => x.GetMovementAsync(new MovementQuery { From = today, To = today }));
        var ntl = movement.Rows.Single(r => r.ProductCode == "NTL-330");
        Assert.Equal((2850, 0, 480, 2370), (ntl.OpeningQty, ntl.InQty, ntl.OutQty, ntl.ClosingQty));
        var transit = movement.InTransit!.Lines.Single(l => l.ProductCode == "NTL-330");
        Assert.Equal((480, 3_456_000m), (transit.Quantity, transit.Value));

        // TC-19 bước 2: vượt số chuyển.
        var tooMany = new ReceiveTransferRequest
        {
            Version = approved.Version, ClientRequestId = KhoScenario.Rid(),
            Lines = [new ReceiveLineInput { LineId = approved.Lines[0].Id, ReceivedBaseQuantity = 500 }]
        };
        ex = await Assert.ThrowsAsync<ValidationException>(() => s.As<ITransferService, TransferDto>("nhanvien", x => x.ReceiveAsync(doc.Id, tooMany)));
        Assert.Contains(ex.Errors, e => e.ErrorMessage == "Không vượt số lượng chuyển 480 chai");

        // thukho.bh không phụ trách KTD.
        tooMany.Lines[0].ReceivedBaseQuantity = 478;
        Assert.Equal("KhongPhuTrachKho", await KhoScenario.CodeOf(() => s.As<ITransferService, TransferDto>("thukho.bh", x => x.ReceiveAsync(doc.Id, tooMany))));

        var received = await s.As<ITransferService, TransferDto>("nhanvien", x => x.ReceiveAsync(doc.Id, tooMany));
        Assert.Equal(TransferStatus.DaNhan, received.Status);
        Assert.Equal(2, received.Lines[0].ShortageQuantity);
        var ktd = await s.Level("KTD", "NTL-330");
        Assert.Equal(568, ktd.OnHand);
        Assert.Equal(7216m, ktd.AvgCost);
        var full = await s.As<ITransferService, TransferDto>("quanly", x => x.GetAsync(doc.Id));
        Assert.Equal(14_400m, full.ShortageValue);
        var ledgerText = await host.QueryAsync<StockLedgerEntry, string>(q => q.Where(e => e.DocId == doc.Id && e.DocType == LedgerDocType.ChuyenDen).Select(e => e.Description).SingleAsync());
        Assert.Equal("Nhận từ KTONG – Kho tổng Bình Tân (thiếu 2 chai)", ledgerText);
    }

    [Fact]
    public async Task Seed_InTransitTodoForBienHoaKeeper()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var bh = await s.As<IInventoryReportService, StaffTodo>("thukho.bh", x => x.GetStaffTodoAsync());
        Assert.Equal(2, bh.ToReceive.Count);
        Assert.Equal(1, bh.ToReceive.Count(t => t.IsLate));
        Assert.Single(bh.Drafts);
        Assert.Equal(2, bh.Waiting.Count);

        var nv = await s.As<IInventoryReportService, StaffTodo>("nhanvien", x => x.GetStaffTodoAsync());
        Assert.Single(nv.Drafts);
        Assert.Single(nv.Rejected);
        Assert.Equal(3, nv.Waiting.Count);
        Assert.Empty(nv.ToReceive);
        Assert.Empty(nv.Counting);
    }

    private static async Task<StocktakeDto> CreateGiaviStocktakeAsync(KhoScenario s)
    {
        var request = new CreateStocktakeRequest
        {
            WarehouseId = await s.Warehouse("KTD"),
            GroupIds = [await s.Host.QueryAsync<ProductGroup, Guid>(q => q.Where(g => g.Code == "GIAVI").Select(g => g.Id).SingleAsync())],
            CounterId = await s.Host.SignInAsync("nhanvien"),
            ClientRequestId = KhoScenario.Rid()
        };
        return (await s.As<IStocktakeService, CreateResult<StocktakeDto>>("quanly", x => x.CreateAsync(request))).Value;
    }

    private static Task<StocktakeDto> CountAsync(KhoScenario s, Guid id, params CountEntry[] entries) =>
        s.As<IStocktakeService, StocktakeDto>("nhanvien", x => x.SubmitCountsAsync(id, new SubmitCountsRequest { ClientRequestId = KhoScenario.Rid(), Entries = [.. entries] }));

    [Fact]
    public async Task Tc26_BlindCountReasonsApprove()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var doc = await CreateGiaviStocktakeAsync(s);
        Assert.Equal("KK26101501", doc.Code);
        Assert.Equal(StocktakeStatus.DangKiem, doc.Status);
        Assert.Equal([("DAU-1L", 240), ("NMAM-750", 120)], doc.Lines.Select(l => (l.ProductCode, l.BookQuantity!.Value)));

        var blind = await s.As<IStocktakeService, StocktakeDto>("nhanvien", x => x.GetAsync(doc.Id));
        Assert.True(blind.IsBlind);
        Assert.All(blind.Lines, l => Assert.Null(l.BookQuantity));

        var dau = await s.Product("DAU-1L");
        var carton = await s.Unit("DAU-1L", 12);
        var scans = Enumerable.Range(0, 19).Select(_ => new CountEntry { ProductId = dau, UnitId = carton, Quantity = 1, Mode = CountMode.Cong })
            .Append(new CountEntry { ProductId = dau, Quantity = 9, Mode = CountMode.Cong }).ToList();
        var request = new SubmitCountsRequest { ClientRequestId = KhoScenario.Rid(), Entries = scans };
        await s.As<IStocktakeService, StocktakeDto>("nhanvien", x => x.SubmitCountsAsync(doc.Id, request));
        var counted = await s.As<IStocktakeService, StocktakeDto>("nhanvien", x => x.SubmitCountsAsync(doc.Id, request)); // gửi lại cùng mã
        Assert.Equal(237, counted.Lines.Single(l => l.ProductCode == "DAU-1L").CountedQuantity);
        counted = await CountAsync(s, doc.Id, new CountEntry { ProductId = await s.Product("NMAM-750"), Quantity = 150, Mode = CountMode.Dat });

        // Ngoài phạm vi.
        var ntl = await s.Product("NTL-330");
        Assert.Equal("NgoaiPhamViKiemKe", await KhoScenario.CodeOf(() =>
            CountAsync(s, doc.Id, new CountEntry { ProductId = ntl, Quantity = 1, Mode = CountMode.Dat })));

        var first = await Assert.ThrowsAsync<DomainException>(() => s.As<IStocktakeService, StocktakeDto>("nhanvien",
            x => x.SubmitAsync(doc.Id, new SubmitStocktakeRequest { Version = counted.Version, ClientRequestId = KhoScenario.Rid() })));
        Assert.Equal("ThieuNguyenNhan", first.Extensions["code"]);
        Assert.Equal("Chọn nguyên nhân cho 1 dòng chênh lệch lớn", first.Message);

        var nmamLine = counted.Lines.Single(l => l.ProductCode == "NMAM-750").Id;
        var submitted = await s.As<IStocktakeService, StocktakeDto>("nhanvien", x => x.SubmitAsync(doc.Id, new SubmitStocktakeRequest
        {
            Version = counted.Version, ClientRequestId = KhoScenario.Rid(),
            Reasons = [new StocktakeReasonInput { LineId = nmamLine, Reason = VarianceReason.NhapXuatChuaLapPhieu }]
        }));
        Assert.Equal(StocktakeStatus.ChoDuyet, submitted.Status);
        var managerView = await s.As<IStocktakeService, StocktakeDto>("quanly", x => x.GetAsync(doc.Id));
        Assert.Equal((990_000m, 156_000m), (managerView.SurplusValue!.Value, managerView.ShortageValue!.Value));
        var dauLine = managerView.Lines.Single(l => l.ProductCode == "DAU-1L");
        Assert.Equal((-3, -156_000m, 1.3m, false), (dauLine.Difference!.Value, dauLine.DifferenceValue!.Value, dauLine.DifferencePercent!.Value, dauLine.ReasonRequired!.Value));

        // Người đếm không tự duyệt.
        Assert.Equal("NguoiDuyetTrungNguoiLap", await KhoScenario.CodeOf(() =>
            s.As<IStocktakeService, StocktakeDto>("nhanvien", x => x.ApproveAsync(doc.Id, KhoScenario.Act(submitted.Version)))));
        var approved = await s.As<IStocktakeService, StocktakeDto>("quanly", x => x.ApproveAsync(doc.Id, KhoScenario.Act(submitted.Version)));
        Assert.Equal(StocktakeStatus.DaCanBang, approved.Status);
        var dauLevel = await s.Level("KTD", "DAU-1L");
        var nmamLevel = await s.Level("KTD", "NMAM-750");
        Assert.Equal((237, 52_000m), (dauLevel.OnHand, dauLevel.AvgCost));
        Assert.Equal((150, 33_000m), (nmamLevel.OnHand, nmamLevel.AvgCost));
        var texts = await host.QueryAsync<StockLedgerEntry, List<string>>(q => q.Where(e => e.DocId == doc.Id).Select(e => e.Description).ToListAsync());
        Assert.Equal(2, texts.Count);
        Assert.All(texts, t => Assert.StartsWith("Điều chỉnh kiểm kê KK26101501", t));
    }

    [Fact]
    public async Task Tc27_Tc30_UncountedFillAndReturnForRecount()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var doc = await CreateGiaviStocktakeAsync(s);
        var dau = await s.Product("DAU-1L");
        var counted = await CountAsync(s, doc.Id, new CountEntry { ProductId = dau, Quantity = 237, Mode = CountMode.Dat });

        var blocked = await Assert.ThrowsAsync<DomainException>(() => s.As<IStocktakeService, StocktakeDto>("nhanvien",
            x => x.SubmitAsync(doc.Id, new SubmitStocktakeRequest { Version = counted.Version, ClientRequestId = KhoScenario.Rid() })));
        Assert.Equal("ConDongChuaDem", blocked.Extensions["code"]);
        Assert.Equal("Còn 1 dòng chưa đếm", blocked.Message);

        var filled = await s.As<IStocktakeService, StocktakeDto>("nhanvien", x => x.FillUncountedAsync(doc.Id, KhoScenario.Act(counted.Version)));
        Assert.Equal(120, filled.Lines.Single(l => l.ProductCode == "NMAM-750").CountedQuantity);
        var submitted = await s.As<IStocktakeService, StocktakeDto>("nhanvien",
            x => x.SubmitAsync(doc.Id, new SubmitStocktakeRequest { Version = filled.Version, ClientRequestId = KhoScenario.Rid() }));
        Assert.Equal(StocktakeStatus.ChoDuyet, submitted.Status);

        // TC-30: trả lại dòng NMAM-750, DAU-1L giữ 237.
        var nmamLine = submitted.Lines.Single(l => l.ProductCode == "NMAM-750").Id;
        var returned = await s.As<IStocktakeService, StocktakeDto>("quanly", x => x.ReturnAsync(doc.Id, new ReturnStocktakeRequest
        {
            Version = submitted.Version, ClientRequestId = KhoScenario.Rid(), LineIds = [nmamLine], Note = "Đếm lại kệ B3"
        }));
        Assert.Equal(StocktakeStatus.DangKiem, returned.Status);
        Assert.True(returned.Lines.Single(l => l.Id == nmamLine).NeedsRecount);
        Assert.Null(returned.Lines.Single(l => l.Id == nmamLine).CountedQuantity);
        Assert.Equal(237, returned.Lines.Single(l => l.ProductCode == "DAU-1L").CountedQuantity);

        var recounted = await CountAsync(s, doc.Id, new CountEntry { ProductId = await s.Product("NMAM-750"), Quantity = 125, Mode = CountMode.Dat });
        var line = (await s.As<IStocktakeService, StocktakeDto>("quanly", x => x.GetAsync(doc.Id))).Lines.Single(l => l.Id == nmamLine);
        Assert.Equal((5, 165_000m, 4.2m, false), (line.Difference!.Value, line.DifferenceValue!.Value, line.DifferencePercent!.Value, line.ReasonRequired!.Value));
        var resubmitted = await s.As<IStocktakeService, StocktakeDto>("nhanvien",
            x => x.SubmitAsync(doc.Id, new SubmitStocktakeRequest { Version = recounted.Version, ClientRequestId = KhoScenario.Rid() }));
        await s.As<IStocktakeService, StocktakeDto>("quanly", x => x.ApproveAsync(doc.Id, KhoScenario.Act(resubmitted.Version)));
        Assert.Equal(125, (await s.Level("KTD", "NMAM-750")).OnHand);
    }

    [Fact]
    public async Task Tc28_Tc29_LockOnlyScopeItems_SecondStocktakeBlocked_Cancel()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var stocktake = await CreateGiaviStocktakeAsync(s);

        var dauIssue = await s.CreateIssueAsync("nhanvien", "KTD", submit: true, ("DAU-1L", 12, 2));
        var ntlIssue = await s.CreateIssueAsync("nhanvien", "KTD", submit: true, ("NTL-330", 24, 1));
        Assert.Equal(DocStatus.ChoDuyet, dauIssue.Status);

        var locked = await Assert.ThrowsAsync<DomainException>(() =>
            s.As<IGoodsIssueService, GoodsIssueDto>("quanly", x => x.ApproveAsync(dauIssue.Id, KhoScenario.Act(dauIssue.Version))));
        Assert.Equal("DangKiemKe", locked.Extensions["code"]);
        Assert.Equal($"Dầu ăn thực vật chai 1L đang kiểm kê tại KTD ({stocktake.Code})", locked.Message);
        var ntl = await s.As<IGoodsIssueService, GoodsIssueDto>("quanly", x => x.ApproveAsync(ntlIssue.Id, KhoScenario.Act(ntlIssue.Version)));
        Assert.Equal(DocStatus.DaDuyet, ntl.Status);

        var second = new CreateStocktakeRequest { WarehouseId = await s.Warehouse("KTD"), ScopeAll = true, CounterId = stocktake.CounterId, ClientRequestId = KhoScenario.Rid() };
        var conflict = await Assert.ThrowsAsync<ConflictException>(() => s.As<IStocktakeService, CreateResult<StocktakeDto>>("quanly", x => x.CreateAsync(second)));
        Assert.Equal("KhoDaCoPhieuKiemKe", conflict.Extensions["code"]);
        Assert.Contains(stocktake.Code, conflict.Message);

        var cancelled = await s.As<IStocktakeService, StocktakeDto>("quanly", x => x.CancelAsync(stocktake.Id, KhoScenario.Act(stocktake.Version)));
        Assert.Equal(StocktakeStatus.DaHuy, cancelled.Status);
        Assert.Equal(240, (await s.Level("KTD", "DAU-1L")).OnHand);
        await s.As<IGoodsIssueService, GoodsIssueDto>("quanly", x => x.ApproveAsync(dauIssue.Id, KhoScenario.Act(dauIssue.Version)));
        Assert.Equal(216, (await s.Level("KTD", "DAU-1L")).OnHand);
    }
}
