using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.Constants;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Enums.Inventory;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Phiếu nhập (UC-03, UC-05, UC-07; 07 §2.4, §3.2, §3.3, §3.8).</summary>
public sealed class GoodsReceiptService(
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<Supplier> suppliers,
    IGenericRepository<Product> products,
    IUnitOfWork unitOfWork,
    IInventoryTransaction transaction,
    IWarehouseScope scope,
    IDocumentCodeGenerator codes,
    IStockPostingService posting,
    IStockQueries stockQueries,
    TimeProvider timeProvider) : IGoodsReceiptService
{
    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<GoodsReceiptListItem>> GetPagedAsync(GoodsReceiptQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var source = receipts.QueryNoTracking();
        if (!actor.AllWarehouses)
        {
            var scopeIds = actor.AssignedWarehouseIds.ToList();
            source = source.Where(x => scopeIds.Contains(x.WarehouseId));
        }
        if (query.WarehouseId is { } warehouseId && actor.InScope(warehouseId))
            source = source.Where(x => x.WarehouseId == warehouseId);
        if (query.Type is { } type)
            source = source.Where(x => x.Type == type);
        if (query.Status is { } status)
            source = source.Where(x => x.Status == status);
        if (query.SupplierId is { } supplierId)
            source = source.Where(x => x.SupplierId == supplierId);
        if (query.CreatedById is { } createdById)
            source = source.Where(x => x.CreatedBy == createdById);
        if (DocumentSupport.ParseRange(query.From, query.To, required: false) is { } range)
            source = source.Where(x => (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) >= range.FromUtc
                && (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) < range.ToUtcExclusive);
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            var supplierIds = suppliers.QueryNoTracking().IgnoreQueryFilters()
                .Where(s => AppDbFunctions.Matches(s.Name, pattern)).Select(s => s.Id);
            source = source.Where(x => AppDbFunctions.Matches(x.Code, pattern)
                || AppDbFunctions.Matches(x.SourceDocNo, pattern)
                || (x.SupplierId != null && supplierIds.Contains(x.SupplierId.Value)));
        }

        var page = await source.Include(x => x.Lines).AsSplitQuery().ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var context = await LoadContextAsync(page.Items, ct);
        return page.Map(items => items.Select(x => (GoodsReceiptListItem)ToDto(x, actor, context, withLines: false)).ToList());
    }

    public async Task<GoodsReceiptDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var doc = await LoadAsync(id, tracking: false, ct);
        var context = await LoadContextAsync([doc], ct);
        DocumentSupport.EnsureScope(actor, doc.WarehouseId, context.Warehouses);
        return ToDto(doc, actor, context, withLines: true);
    }

    public async Task<CreateResult<GoodsReceiptDto>> CreateAsync(SaveGoodsReceiptRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        if (request.Submit && !actor.Can(ProjectPermissions.GoodsReceipts.Update))
            throw new ForbiddenException("Bạn không có quyền gửi duyệt phiếu nhập.");

        var (id, created) = await transaction.RunAsync(async token =>
        {
            var existing = await receipts.QueryNoTracking().Where(x => x.ClientRequestId == request.ClientRequestId)
                .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(token);
            if (existing is { } existingId)
                return (existingId, false);

            var doc = new GoodsReceipt
            {
                Status = DocStatus.Nhap,
                CreatedBy = actor.UserId,
                CreatedByName = actor.FullName,
                ClientRequestId = request.ClientRequestId,
                LastRequestId = request.ClientRequestId
            };
            await ApplyAsync(doc, request, actor, isNew: true, token);
            if (request.Submit)
                await SubmitCoreAsync(doc, token);
            await receipts.AddAsync(doc, token);
            await unitOfWork.SaveChangesAsync(token);
            return (doc.Id, true);
        }, ct);

        return new CreateResult<GoodsReceiptDto>(await GetAsync(id, ct), created);
    }

    public async Task<GoodsReceiptDto> UpdateAsync(Guid id, SaveGoodsReceiptRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, request.Version, actor, async (doc, token) =>
        {
            Editable(doc);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            await ApplyAsync(doc, request, actor, isNew: false, token);
            if (request.Submit)
                await SubmitCoreAsync(doc, token);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsReceiptDto> SubmitAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, request.Version, actor, async (doc, token) =>
        {
            Editable(doc);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var errors = new FieldErrorBag();
            await DocumentSupport.RequireWarehouseAsync(warehouses, doc.WarehouseId, actor, "warehouseId", errors, token);
            if (doc.Lines.Count == 0)
                errors.Add("lines", DocumentSupport.LinesRequired);
            await ValidateSubmitAsync(doc.Type, doc.SupplierId, errors, token);
            errors.ThrowIfAny();
            await SubmitCoreAsync(doc, token);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsReceiptDto> WithdrawAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, request.Version, actor, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status == DocStatus.ChoDuyet);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            doc.Status = DocStatus.Nhap;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsReceiptDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, request.Version, actor, async (doc, token) =>
        {
            EnsureStatus(doc, doc.Status == DocStatus.ChoDuyet);
            DocumentSupport.EnsureNotCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            await ApproveCoreAsync(doc, actor.UserId, actor.FullName, Now, token);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsReceiptDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, request.Version, actor, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status == DocStatus.ChoDuyet);
            DocumentSupport.EnsureNotCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var reason = DocumentSupport.RequireRejectReason(request.Reason);
            doc.Status = DocStatus.TuChoi;
            doc.RejectedById = actor.UserId;
            doc.RejectedByName = actor.FullName;
            doc.RejectedAt = Now;
            doc.RejectReason = reason;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsReceiptDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, request.Version, actor, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status is DocStatus.Nhap or DocStatus.TuChoi);
            if (doc.CreatedBy != actor.UserId && !actor.Can(ProjectPermissions.GoodsReceipts.Approve))
                DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            doc.Status = DocStatus.DaHuy;
            doc.CancelledById = actor.UserId;
            doc.CancelledByName = actor.FullName;
            doc.CancelledAt = Now;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    /// <summary>BR-12, UC-07: phiếu xuất nháp loại Xuất điều chỉnh, mỗi dòng gốc thành một dòng đơn vị cơ bản.</summary>
    public async Task<CreateResult<Guid>> ReverseAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        var (issueId, created) = await transaction.RunAsync(async token =>
        {
            var existing = await issues.QueryNoTracking().Where(x => x.ClientRequestId == request.ClientRequestId)
                .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(token);
            if (existing is { } existingId)
                return (existingId, false);

            var doc = await LoadAsync(id, tracking: true, token);
            var names = await DocumentSupport.WarehousesAsync(warehouses, token);
            DocumentSupport.EnsureScope(actor, doc.WarehouseId, names);
            if (doc.Status != DocStatus.DaDuyet || doc.Type == ReceiptType.NhapDieuChinh)
                throw InventoryErrors.Business(InventoryErrors.KhongTaoPhieuNguoc, InventoryErrors.CannotReverseMessage);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var reversal = await issues.QueryNoTracking()
                .Where(x => x.ReversalOfReceiptId == doc.Id && x.Status != DocStatus.DaHuy)
                .Select(x => new { x.Code }).FirstOrDefaultAsync(token);
            if (reversal is not null)
                throw InventoryProblems.Coded(InventoryErrors.PhieuNguocDaCo, InventoryErrors.AlreadyReversed(doc.Code, reversal.Code));

            var issue = new GoodsIssue
            {
                WarehouseId = doc.WarehouseId,
                Type = IssueType.XuatDieuChinh,
                Reason = $"Phiếu ngược của {doc.Code}",
                Status = DocStatus.Nhap,
                ReversalOfReceiptId = doc.Id,
                CreatedBy = actor.UserId,
                CreatedByName = actor.FullName,
                ClientRequestId = request.ClientRequestId,
                LastRequestId = request.ClientRequestId,
                Lines = doc.Lines.OrderBy(l => l.LineNo).Select((l, i) => new GoodsIssueLine
                {
                    LineNo = i + 1,
                    ProductId = l.ProductId,
                    ProductCode = l.ProductCode,
                    ProductName = l.ProductName,
                    BaseUnit = l.BaseUnit,
                    UnitName = l.BaseUnit,
                    Factor = 1,
                    Quantity = l.BaseQuantity,
                    BaseQuantity = l.BaseQuantity
                }).ToList()
            };
            DocumentSupport.Touch(doc, doc.LastRequestId);
            await issues.AddAsync(issue, token);
            await unitOfWork.SaveChangesAsync(token);
            return (issue.Id, true);
        }, ct);

        return new CreateResult<Guid>(issueId, created);
    }

    /// <summary>
    /// Ghi sổ phiếu nhập (§3.3) trong transaction đang mở: kiểm khóa kiểm kê (BR-14), thay đơn giá 0 của hàng bán bị trả lại
    /// bằng giá vốn hiện tại × hệ số (quyết định 9), áp BR-08, BR-09, đổi trạng thái. Seeder gọi cùng hàm này.
    /// </summary>
    internal async Task ApproveCoreAsync(GoodsReceipt doc, Guid approverId, string approverName, DateTime at, CancellationToken ct)
    {
        var productIds = doc.Lines.Select(l => l.ProductId).Distinct().ToList();
        var stocktakeLock = await stockQueries.FindLockAsync(doc.WarehouseId, productIds, ct);
        if (stocktakeLock is not null)
            throw await CountingErrorAsync(warehouses, doc.WarehouseId, doc.Lines, stocktakeLock, ct);

        var book = await posting.LoadBookAsync(productIds.Select(p => (doc.WarehouseId, p)), ct);
        if (doc.Type == ReceiptType.HangBanTraLai)
        {
            foreach (var line in doc.Lines.Where(l => l.UnitPrice == 0))
                line.UnitPrice = (book.Find(doc.WarehouseId, line.ProductId)?.AvgCost ?? 0) * line.Factor;
        }

        var supplierName = doc.SupplierId is { } sid
            ? await suppliers.QueryNoTracking().IgnoreQueryFilters().Where(s => s.Id == sid).Select(s => s.Name).FirstOrDefaultAsync(ct)
            : null;
        var originalCode = doc.ReversalOfIssueId is { } rid
            ? await issues.QueryNoTracking().Where(x => x.Id == rid).Select(x => x.Code).FirstOrDefaultAsync(ct)
            : null;

        await posting.PostReceiptAsync(book, doc, at, DocumentSupport.ReceiptDescription(doc, supplierName, originalCode), ct);
        doc.Status = DocStatus.DaDuyet;
        doc.ApprovedById = approverId;
        doc.ApprovedByName = approverName;
        doc.ApprovedAt = at;
    }

    internal static async Task<Domain.Common.DomainException> CountingErrorAsync(
        IGenericRepository<Warehouse> warehouses,
        Guid warehouseId,
        IEnumerable<Domain.Entities.Inventory.Documents.DocLine> lines,
        StocktakeLock stocktakeLock,
        CancellationToken ct)
    {
        var code = await warehouses.QueryNoTracking().IgnoreQueryFilters().Where(w => w.Id == warehouseId).Select(w => w.Code).FirstAsync(ct);
        var first = lines.OrderBy(l => l.LineNo).First(l => stocktakeLock.ProductIds.Contains(l.ProductId));
        return InventoryErrors.Business(InventoryErrors.DangKiemKe,
            InventoryErrors.Counting(first.ProductName, code, stocktakeLock.Code),
            new Dictionary<string, object?>
            {
                ["stocktakeId"] = stocktakeLock.StocktakeId,
                ["stocktakeCode"] = stocktakeLock.Code,
                ["productIds"] = stocktakeLock.ProductIds
            });
    }

    private async Task ActAsync(
        Guid id, string? clientRequestId, int? version, InventoryActor actor, Func<GoodsReceipt, CancellationToken, Task> action, CancellationToken ct)
    {
        DocumentSupport.RequireClientRequestId(clientRequestId);
        await transaction.RunAsync(async token =>
        {
            var doc = await LoadAsync(id, tracking: true, token);
            var names = await DocumentSupport.WarehousesAsync(warehouses, token);
            DocumentSupport.EnsureScope(actor, doc.WarehouseId, names);
            if (doc.LastRequestId == clientRequestId)
                return true;

            await action(doc, token);
            DocumentSupport.Touch(doc, clientRequestId);
            await unitOfWork.SaveChangesAsync(token);
            return true;
        }, ct);
    }

    private async Task ApplyAsync(GoodsReceipt doc, SaveGoodsReceiptRequest request, InventoryActor actor, bool isNew, CancellationToken ct)
    {
        var errors = new FieldErrorBag();
        await DocumentSupport.RequireWarehouseAsync(warehouses, request.WarehouseId, actor, "warehouseId", errors, ct);

        var keepReversalType = !isNew && doc.Type == ReceiptType.NhapDieuChinh;
        var type = keepReversalType ? ReceiptType.NhapDieuChinh : request.Type;
        if (!keepReversalType && (!Enum.IsDefined(request.Type) || request.Type == ReceiptType.NhapDieuChinh))
            errors.Add("type", "Chọn loại nhập");

        if (request.SupplierId is { } supplierId && !await suppliers.AnyAsync(s => s.Id == supplierId, ct))
            errors.Add("supplierId", "Nhà cung cấp không tồn tại");
        if (request.SourceDocDate is { } date && date > VietnamDates.Today(timeProvider))
            errors.Add("sourceDocDate", "Ngày chứng từ không được sau hôm nay");
        var freight = request.FreightCost ?? 0;
        if (freight < 0 || freight != decimal.Truncate(freight))
            errors.Add("freightCost", "Chi phí mua hàng không được âm");

        var lines = await DocumentSupport.ResolveLinesAsync(products, request.Lines, request.Submit, errors, ct);
        for (var i = 0; i < request.Lines.Count; i++)
        {
            var price = request.Lines[i].UnitPrice;
            if (price < 0 || price != decimal.Truncate(price))
                errors.Add($"lines[{i}].unitPrice", "Đơn giá không được âm");
        }

        if (request.Submit)
            await ValidateSubmitAsync(type, request.SupplierId, errors, ct);
        errors.ThrowIfAny();

        doc.WarehouseId = request.WarehouseId;
        doc.Type = type;
        doc.SupplierId = request.SupplierId;
        doc.DelivererName = DocumentSupport.Limit(request.DelivererName, 150);
        doc.SourceDocNo = DocumentSupport.Limit(request.SourceDocNo, 30);
        doc.SourceDocDate = request.SourceDocDate;
        doc.Note = DocumentSupport.Limit(request.Note, 500);
        doc.FreightCost = freight;

        doc.Lines.Clear();
        foreach (var resolved in lines)
        {
            var line = new GoodsReceiptLine { UnitPrice = request.Lines[resolved.Index].UnitPrice };
            resolved.FillTo(line, doc.Lines.Count + 1);
            doc.Lines.Add(line);
        }

        StockPosting.RecalculateReceipt(doc);
    }

    private async Task ValidateSubmitAsync(ReceiptType type, Guid? supplierId, FieldErrorBag errors, CancellationToken ct)
    {
        if (type != ReceiptType.MuaHang)
            return;
        if (supplierId is not { } id)
        {
            errors.Add("supplierId", "Chọn nhà cung cấp");
            return;
        }

        var supplier = await suppliers.QueryNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct);
        if (supplier is { IsActive: false })
            errors.Add("supplierId", $"Nhà cung cấp {supplier.Code} đã ngừng giao dịch");
    }

    private async Task SubmitCoreAsync(GoodsReceipt doc, CancellationToken ct)
    {
        var now = Now;
        doc.Code ??= await codes.NextAsync(InventoryRules.ReceiptPrefix, now, ct);
        doc.Status = DocStatus.ChoDuyet;
        doc.SubmittedAt = now;
    }

    private static void Editable(GoodsReceipt doc) => EnsureStatus(doc, doc.Status is DocStatus.Nhap or DocStatus.TuChoi);

    private static void EnsureStatus(GoodsReceipt doc, bool allowed) =>
        DocumentSupport.EnsureStatus(allowed, doc.Status == DocStatus.DaDuyet, doc, InventoryRules.Label(doc.Status), doc.Status.ToString());

    private async Task<GoodsReceipt> LoadAsync(Guid id, bool tracking, CancellationToken ct)
    {
        var source = tracking ? receipts.Query() : receipts.QueryNoTracking();
        return await source.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu nhập.");
    }

    private sealed record DtoContext(
        Dictionary<Guid, Warehouse> Warehouses,
        Dictionary<Guid, Supplier> Suppliers,
        Dictionary<Guid, string?> ReversalOfCodes,
        Dictionary<Guid, (Guid Id, string? Code)> ReversedBy);

    private async Task<DtoContext> LoadContextAsync(IReadOnlyCollection<GoodsReceipt> docs, CancellationToken ct)
    {
        var ids = docs.Select(d => d.Id).ToList();
        var originIds = docs.Where(d => d.ReversalOfIssueId != null).Select(d => d.ReversalOfIssueId!.Value).ToList();
        var origins = await issues.QueryNoTracking().Where(x => originIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Code, ct);
        var reversed = await issues.QueryNoTracking()
            .Where(x => x.ReversalOfReceiptId != null && ids.Contains(x.ReversalOfReceiptId.Value) && x.Status != DocStatus.DaHuy)
            .Select(x => new { Origin = x.ReversalOfReceiptId!.Value, x.Id, x.Code })
            .ToListAsync(ct);
        return new DtoContext(
            await DocumentSupport.WarehousesAsync(warehouses, ct),
            await DocumentSupport.SuppliersAsync(suppliers, ct),
            origins,
            reversed.GroupBy(x => x.Origin).ToDictionary(g => g.Key, g => (g.First().Id, g.First().Code)));
    }

    private static GoodsReceiptDto ToDto(GoodsReceipt x, InventoryActor actor, DtoContext context, bool withLines)
    {
        var canView = actor.CanViewValues || x.CreatedBy == actor.UserId;
        var warehouse = context.Warehouses.GetValueOrDefault(x.WarehouseId);
        var supplier = x.SupplierId is { } sid ? context.Suppliers.GetValueOrDefault(sid) : null;
        var reversedBy = context.ReversedBy.TryGetValue(x.Id, out var r) ? r : ((Guid Id, string? Code)?)null;
        return new GoodsReceiptDto
        {
            Id = x.Id,
            Code = x.Code,
            WarehouseId = x.WarehouseId,
            WarehouseCode = warehouse?.Code ?? string.Empty,
            WarehouseName = warehouse?.Name ?? string.Empty,
            Type = x.Type,
            SupplierId = x.SupplierId,
            SupplierCode = supplier?.Code,
            SupplierName = supplier?.Name,
            DelivererName = x.DelivererName,
            SourceDocNo = x.SourceDocNo,
            SourceDocDate = x.SourceDocDate,
            Note = x.Note,
            FreightCost = canView ? x.FreightCost : null,
            TotalAmount = canView ? x.TotalAmount : null,
            TotalValue = canView ? x.TotalValue : null,
            Status = x.Status,
            Version = x.Version,
            CreatedById = x.CreatedBy ?? Guid.Empty,
            CreatedByName = x.CreatedByName,
            CreatedAt = x.CreatedAt,
            SubmittedAt = x.SubmittedAt,
            ApprovedById = x.ApprovedById,
            ApprovedByName = x.ApprovedByName,
            ApprovedAt = x.ApprovedAt,
            RejectedByName = x.RejectedByName,
            RejectedAt = x.RejectedAt,
            RejectReason = x.RejectReason,
            CancelledByName = x.CancelledByName,
            CancelledAt = x.CancelledAt,
            ReversalOfId = x.ReversalOfIssueId,
            ReversalOfCode = x.ReversalOfIssueId is { } oid ? context.ReversalOfCodes.GetValueOrDefault(oid) : null,
            ReversedById = reversedBy?.Id,
            ReversedByCode = reversedBy?.Code,
            LineCount = x.Lines.Count,
            CanViewValues = canView,
            Lines = withLines
                ? x.Lines.OrderBy(l => l.LineNo).Select(l => new GoodsReceiptLineDto
                {
                    Id = l.Id,
                    LineNo = l.LineNo,
                    ProductId = l.ProductId,
                    ProductCode = l.ProductCode,
                    ProductName = l.ProductName,
                    BaseUnit = l.BaseUnit,
                    UnitId = l.UnitId,
                    UnitName = l.UnitName,
                    Factor = l.Factor,
                    Quantity = l.Quantity,
                    BaseQuantity = l.BaseQuantity,
                    UnitPrice = canView ? l.UnitPrice : null,
                    Amount = canView ? l.Amount : null,
                    AllocatedCost = canView ? l.AllocatedCost : null,
                    Value = canView ? l.Value : null,
                    LandedUnitPrice = canView ? StockMath.LandedUnitPrice(l.Value, l.Quantity) : null
                }).ToList()
                : []
        };
    }
}
