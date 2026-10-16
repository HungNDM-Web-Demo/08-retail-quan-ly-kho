using Application.Common.Exceptions;
using Application.DTOs.Inventory;
using Application.Interfaces.Services.Inventory;
using Domain.Common;
using Domain.Entities.Inventory.Stock;
using Domain.Enums.Inventory;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Inventory;

/// <summary>Phiếu nhập, phiếu xuất, duyệt, phiếu ngược (TC-07…TC-17, TC-20; 07 §3.8).</summary>
public class DocumentFlowTests
{
    [Fact]
    public async Task Tc07_Tc13_SubmitThenApprove_PostsStockAndLedger_Idempotent()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);

        var doc = await s.CreateReceiptAsync("nhanvien", "KTONG", "NCC001", submit: true, 0, ("NTL-330", 24, 100, 180_000));
        Assert.Equal(DocStatus.ChoDuyet, doc.Status);
        Assert.StartsWith("PN261015", doc.Code);
        Assert.Equal(18_000_000m, doc.Lines.Single().Amount);
        Assert.Equal(2400, (await s.Level("KTONG", "NTL-330")).OnHand);

        var approve = KhoScenario.Act(doc.Version);
        var approved = await s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.ApproveAsync(doc.Id, approve));
        Assert.Equal(DocStatus.DaDuyet, approved.Status);
        var level = await s.Level("KTONG", "NTL-330");
        Assert.Equal(4800, level.OnHand);
        Assert.Equal(7350m, level.AvgCost);
        Assert.Equal(35_280_000m, level.StockValue);

        // Bấm duyệt lần hai cùng clientRequestId: trả kết quả cũ, không ghi sổ lần hai.
        var again = await s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.ApproveAsync(doc.Id, approve));
        Assert.Equal(approved.Version, again.Version);
        var entries = await host.QueryAsync<StockLedgerEntry, List<StockLedgerEntry>>(q => q.Where(e => e.DocId == doc.Id).ToListAsync());
        Assert.Single(entries);
        Assert.Equal(2400, entries[0].InQuantity);
        Assert.Equal(4800, entries[0].BalanceQuantity);
        Assert.Equal(4800, (await s.Level("KTONG", "NTL-330")).OnHand);

        // Duyệt lại bằng thao tác mới → 409 PhieuDaDuyet.
        Assert.Equal("PhieuDaDuyet", await KhoScenario.CodeOf(() =>
            s.As<IGoodsReceiptService, GoodsReceiptDto>("admin", x => x.ApproveAsync(doc.Id, KhoScenario.Act(approved.Version)))));
    }

    [Fact]
    public async Task Tc08_FreightAllocatedIntoCost()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var doc = await s.CreateReceiptAsync("nhanvien", "KTONG", "NCC001", submit: true, 1_200_000,
            ("NTL-330", 24, 100, 180_000), ("DAU-1L", 12, 50, 600_000));
        Assert.Equal([450_000m, 750_000m], doc.Lines.Select(l => l.AllocatedCost!.Value));
        Assert.Equal([18_450_000m, 30_750_000m], doc.Lines.Select(l => l.Value!.Value));

        await s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.ApproveAsync(doc.Id, KhoScenario.Act(doc.Version)));
        Assert.Equal(7444m, (await s.Level("KTONG", "NTL-330")).AvgCost);
        var dau = await s.Level("KTONG", "DAU-1L");
        Assert.Equal(1200, dau.OnHand);
        Assert.Equal(51_625m, dau.AvgCost);
    }

    [Fact]
    public async Task Tc09_Tc10_ValidationWithdrawResubmit_Stale409()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var warehouse = await s.Warehouse("KTONG");
        var line = new ReceiptLineInput { ProductId = await s.Product("NTL-330"), UnitId = await s.Unit("NTL-330", 24), Quantity = 100, UnitPrice = 180_000 };

        var missingSupplier = new SaveGoodsReceiptRequest { WarehouseId = warehouse, Type = ReceiptType.MuaHang, Submit = true, ClientRequestId = KhoScenario.Rid(), Lines = [line] };
        var ex = await Assert.ThrowsAsync<ValidationException>(() => s.As<IGoodsReceiptService, CreateResult<GoodsReceiptDto>>("nhanvien", x => x.CreateAsync(missingSupplier)));
        Assert.Contains(ex.Errors, e => e.PropertyName == "supplierId" && e.ErrorMessage == "Chọn nhà cung cấp");

        var zero = new SaveGoodsReceiptRequest
        {
            WarehouseId = warehouse, Type = ReceiptType.MuaHang, SupplierId = await s.Supplier("NCC001"), Submit = true, ClientRequestId = KhoScenario.Rid(),
            Lines = [new ReceiptLineInput { ProductId = line.ProductId, Quantity = 0, UnitPrice = 1 }]
        };
        ex = await Assert.ThrowsAsync<ValidationException>(() => s.As<IGoodsReceiptService, CreateResult<GoodsReceiptDto>>("nhanvien", x => x.CreateAsync(zero)));
        Assert.Contains(ex.Errors, e => e.PropertyName == "lines[0].quantity");

        zero.Lines[0].Quantity = 1;
        zero.SourceDocDate = DateOnly.FromDateTime(KhoTestHost.Start.UtcDateTime).AddDays(1);
        ex = await Assert.ThrowsAsync<ValidationException>(() => s.As<IGoodsReceiptService, CreateResult<GoodsReceiptDto>>("nhanvien", x => x.CreateAsync(zero)));
        Assert.Contains(ex.Errors, e => e.PropertyName == "sourceDocDate" && e.ErrorMessage == "Ngày chứng từ không được sau hôm nay");

        var doc = await s.CreateReceiptAsync("nhanvien", "KTONG", "NCC001", submit: true, 0, ("NTL-330", 24, 100, 180_000));
        var withdrawn = await s.As<IGoodsReceiptService, GoodsReceiptDto>("nhanvien", x => x.WithdrawAsync(doc.Id, KhoScenario.Act(doc.Version)));
        Assert.Equal(DocStatus.Nhap, withdrawn.Status);

        // Phiên bản cũ → 409 DuLieuCu kèm currentVersion.
        var stale = await Assert.ThrowsAsync<ConflictException>(() =>
            s.As<IGoodsReceiptService, GoodsReceiptDto>("nhanvien", x => x.SubmitAsync(doc.Id, KhoScenario.Act(doc.Version))));
        Assert.Equal("DuLieuCu", stale.Extensions["code"]);
        Assert.Equal(withdrawn.Version, stale.Extensions["currentVersion"]);

        // Sai trạng thái → TrangThaiKhongHopLe; trạng thái phiếu ở `docStatus`, không đè `status` (mã HTTP) của ProblemDetails.
        var wrongState = await Assert.ThrowsAsync<DomainException>(() =>
            s.As<IGoodsReceiptService, GoodsReceiptDto>("nhanvien", x => x.WithdrawAsync(doc.Id, KhoScenario.Act(withdrawn.Version))));
        Assert.Equal("TrangThaiKhongHopLe", wrongState.Extensions["code"]);
        Assert.Equal("Nhap", wrongState.Extensions["docStatus"]);
        Assert.False(wrongState.Extensions.ContainsKey("status"));

        var update = new SaveGoodsReceiptRequest
        {
            WarehouseId = warehouse, Type = ReceiptType.MuaHang, SupplierId = await s.Supplier("NCC001"), SourceDocNo = "0001234",
            Submit = true, ClientRequestId = KhoScenario.Rid(), Version = withdrawn.Version,
            Lines = [new ReceiptLineInput { ProductId = line.ProductId, UnitId = line.UnitId, Quantity = 100, UnitPrice = 178_000 }]
        };
        var resubmitted = await s.As<IGoodsReceiptService, GoodsReceiptDto>("nhanvien", x => x.UpdateAsync(doc.Id, update));
        Assert.Equal(DocStatus.ChoDuyet, resubmitted.Status);
        Assert.Equal(17_800_000m, resubmitted.TotalAmount);
        Assert.Equal(doc.Code, resubmitted.Code);

        // Người khác sửa → KhongPhaiNguoiLap.
        Assert.Equal("KhongPhaiNguoiLap", await KhoScenario.CodeOf(() =>
            s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.WithdrawAsync(doc.Id, KhoScenario.Act(resubmitted.Version)))));
    }

    [Fact]
    public async Task Tc16_CreatorCannotApprove_AdminCan()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var doc = await s.CreateReceiptAsync("quanly", "KTD", "NCC002", submit: true, 0, ("NMAM-750", 12, 10, 390_000));

        var items = await s.As<IApprovalService, IReadOnlyList<ApprovalItem>>("quanly", x => x.GetPendingAsync(new ApprovalQuery()));
        var item = items.Single(i => i.Id == doc.Id);
        Assert.False(item.CanApprove);
        Assert.Equal("Người duyệt phải khác người lập", item.BlockedReason);
        Assert.Equal(7, items.Count);
        Assert.True(items.Zip(items.Skip(1)).All(p => p.First.SubmittedAt <= p.Second.SubmittedAt));

        Assert.Equal("NguoiDuyetTrungNguoiLap", await KhoScenario.CodeOf(() =>
            s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.ApproveAsync(doc.Id, KhoScenario.Act(doc.Version)))));
        await s.As<IGoodsReceiptService, GoodsReceiptDto>("admin", x => x.ApproveAsync(doc.Id, KhoScenario.Act(doc.Version)));
        var level = await s.Level("KTD", "NMAM-750");
        Assert.Equal(240, level.OnHand);
        Assert.Equal(32_750m, level.AvgCost);
    }

    [Fact]
    public async Task Tc11_Tc14_Tc15_Tc21_AvailabilityApproveRejectResubmit()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var a = await s.CreateIssueAsync("nhanvien", "KTONG", submit: true, ("NGIAT-37", 4, 30));
        Assert.Equal(DocStatus.ChoDuyet, a.Status);

        var over = await Assert.ThrowsAsync<DomainException>(() => s.CreateIssueAsync("nhanvien", "KTONG", submit: true, ("NGIAT-37", 4, 25)));
        Assert.Equal("VuotTonKhaDung", over.Extensions["code"]);
        Assert.Equal("Vượt tồn khả dụng 20 túi", over.Message);

        // TC-21: tồn thực 200, chờ xuất 120, khả dụng 80, Dưới tối thiểu; giữ chỗ thấy PX A.
        var stock = await s.As<IStockService, StockListResult>("quanly", x => x.GetLevelsAsync(new StockQuery { WarehouseId = null, Search = "NGIAT-37" }));
        var ktong = await s.Warehouse("KTONG");
        var one = await s.As<IStockService, StockListResult>("quanly", x => x.GetLevelsAsync(new StockQuery { WarehouseId = ktong, Search = "ngiat-37" }));
        var row = one.Items.Single();
        Assert.Equal((200, 120, 80), (row.OnHand, row.Reserved, row.Available));
        Assert.Equal("50 thùng", row.Reading);
        Assert.Equal(189_000m, row.AvgCost);
        Assert.Equal(37_800_000m, row.StockValue);
        Assert.Equal(StockStatus.DuoiToiThieu, row.Status);
        Assert.NotEmpty(stock.Items);
        var reservations = await s.As<IStockService, IReadOnlyList<ReservationDto>>("quanly",
            x => x.GetReservationsAsync(new ReservationQuery { WarehouseId = ktong, ProductId = row.ProductId }));
        Assert.Contains(reservations, r => r.DocId == a.Id && r.BaseQuantity == 120);

        // TC-15: lý do ngắn bị chặn; từ chối giải phóng giữ chỗ; gửi lại 20 thùng.
        await Assert.ThrowsAsync<ValidationException>(() =>
            s.As<IGoodsIssueService, GoodsIssueDto>("quanly", x => x.RejectAsync(a.Id, new RejectRequest { Version = a.Version, ClientRequestId = KhoScenario.Rid(), Reason = "Sai SL" })));
        var rejected = await s.As<IGoodsIssueService, GoodsIssueDto>("quanly",
            x => x.RejectAsync(a.Id, new RejectRequest { Version = a.Version, ClientRequestId = KhoScenario.Rid(), Reason = "Đại lý chỉ đặt 20 thùng" }));
        Assert.Equal(DocStatus.TuChoi, rejected.Status);
        var available = await s.As<IStockService, IReadOnlyList<AvailabilityRow>>("nhanvien", x => x.GetAvailabilityAsync(ktong));
        Assert.Equal(200, available.Single(r => r.ProductId == row.ProductId).Available);
        var todo = await s.As<IInventoryReportService, StaffTodo>("nhanvien", x => x.GetStaffTodoAsync());
        Assert.Contains(todo.Rejected, r => r.Id == a.Id && r.RejectReason == "Đại lý chỉ đặt 20 thùng");

        var update = new SaveGoodsIssueRequest
        {
            WarehouseId = ktong, Type = IssueType.XuatBan, RecipientName = "Đại lý Tạp hóa Thanh Hương", Submit = true,
            ClientRequestId = KhoScenario.Rid(), Version = rejected.Version, Lines = [await s.LineAsync("NGIAT-37", 4, 20)]
        };
        var resent = await s.As<IGoodsIssueService, GoodsIssueDto>("nhanvien", x => x.UpdateAsync(a.Id, update));
        Assert.Equal(DocStatus.ChoDuyet, resent.Status);
        available = await s.As<IStockService, IReadOnlyList<AvailabilityRow>>("nhanvien", x => x.GetAvailabilityAsync(ktong));
        Assert.Equal(120, available.Single(r => r.ProductId == row.ProductId).Available);
    }

    [Fact]
    public async Task Tc14_Tc20_ApproveIssue_ThenReversal()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var a = await s.CreateIssueAsync("nhanvien", "KTONG", submit: true, ("NGIAT-37", 4, 30));
        var approved = await s.As<IGoodsIssueService, GoodsIssueDto>("quanly", x => x.ApproveAsync(a.Id, KhoScenario.Act(a.Version)));
        Assert.Equal(22_680_000m, approved.TotalValue);
        var level = await s.Level("KTONG", "NGIAT-37");
        Assert.Equal(80, level.OnHand);
        Assert.Equal(15_120_000m, level.StockValue);
        var alerts = await s.As<IStockService, IReadOnlyList<StockAlertDto>>("quanly", x => x.GetAlertsAsync(new StockAlertQuery { WarehouseId = level.WarehouseId }));
        Assert.Contains(alerts, x => x.ProductCode == "NGIAT-37" && x.Status == StockStatus.DuoiToiThieu);

        // Thủ kho không thấy giá trị ở phiếu xuất (BR-25).
        var staffView = await s.As<IGoodsIssueService, GoodsIssueDto>("nhanvien", x => x.GetAsync(a.Id));
        Assert.False(staffView.CanViewValues);
        Assert.Null(staffView.TotalValue);

        var request = KhoScenario.Act(approved.Version);
        var reversal = await s.As<IGoodsIssueService, CreateResult<Guid>>("quanly", x => x.ReverseAsync(a.Id, request));
        Assert.True(reversal.Created);
        var again = await s.As<IGoodsIssueService, CreateResult<Guid>>("quanly", x => x.ReverseAsync(a.Id, request));
        Assert.False(again.Created);
        Assert.Equal(reversal.Value, again.Value);
        var receipt = await s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.GetAsync(reversal.Value));
        Assert.Equal(ReceiptType.NhapDieuChinh, receipt.Type);
        Assert.Equal((120, 189_000m), (receipt.Lines.Single().Quantity, receipt.Lines.Single().UnitPrice!.Value));
        Assert.Equal(approved.Code, receipt.ReversalOfCode);

        var original = await s.As<IGoodsIssueService, GoodsIssueDto>("quanly", x => x.GetAsync(a.Id));
        Assert.Equal("PhieuNguocDaCo", await KhoScenario.CodeOf(() =>
            s.As<IGoodsIssueService, CreateResult<Guid>>("quanly", x => x.ReverseAsync(a.Id, KhoScenario.Act(original.Version)))));
        Assert.Equal("KhongTaoPhieuNguoc", await KhoScenario.CodeOf(() =>
            s.As<IGoodsReceiptService, CreateResult<Guid>>("quanly", x => x.ReverseAsync(receipt.Id, KhoScenario.Act(receipt.Version)))));

        var submitted = await s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.SubmitAsync(receipt.Id, KhoScenario.Act(receipt.Version)));
        await s.As<IGoodsReceiptService, GoodsReceiptDto>("admin", x => x.ApproveAsync(receipt.Id, KhoScenario.Act(submitted.Version)));
        level = await s.Level("KTONG", "NGIAT-37");
        Assert.Equal(200, level.OnHand);
        Assert.Equal(189_000m, level.AvgCost);
        Assert.Equal(original.Id, (await s.As<IGoodsReceiptService, GoodsReceiptDto>("quanly", x => x.GetAsync(receipt.Id))).ReversalOfId);
        Assert.Equal(receipt.Id, (await s.As<IGoodsIssueService, GoodsIssueDto>("quanly", x => x.GetAsync(a.Id))).ReversedById);
    }

    [Fact]
    public async Task Tc12_IssueRequiredFields()
    {
        await using var host = await KhoTestHost.StartAsync();
        var s = new KhoScenario(host);
        var noRecipient = new SaveGoodsIssueRequest
        {
            WarehouseId = await s.Warehouse("KTONG"), Type = IssueType.XuatBan, Submit = true, ClientRequestId = KhoScenario.Rid(),
            Lines = [await s.LineAsync("NGIAT-37", 1, 1)]
        };
        var ex = await Assert.ThrowsAsync<ValidationException>(() => s.As<IGoodsIssueService, CreateResult<GoodsIssueDto>>("nhanvien", x => x.CreateAsync(noRecipient)));
        Assert.Contains(ex.Errors, e => e.PropertyName == "recipientName" && e.ErrorMessage == "Nhập người nhận");

        noRecipient.Type = IssueType.XuatHuy;
        noRecipient.ClientRequestId = KhoScenario.Rid();
        ex = await Assert.ThrowsAsync<ValidationException>(() => s.As<IGoodsIssueService, CreateResult<GoodsIssueDto>>("nhanvien", x => x.CreateAsync(noRecipient)));
        Assert.Contains(ex.Errors, e => e.PropertyName == "reason" && e.ErrorMessage == "Nhập lý do xuất hủy");

        // Lưu nháp chỉ kiểm định dạng; tạo lại cùng clientRequestId trả phiếu cũ.
        noRecipient.Submit = false;
        var draft = await s.As<IGoodsIssueService, CreateResult<GoodsIssueDto>>("nhanvien", x => x.CreateAsync(noRecipient));
        var repeat = await s.As<IGoodsIssueService, CreateResult<GoodsIssueDto>>("nhanvien", x => x.CreateAsync(noRecipient));
        Assert.True(draft.Created);
        Assert.False(repeat.Created);
        Assert.Equal(draft.Value.Id, repeat.Value.Id);
        Assert.Null(draft.Value.Code);
    }
}
