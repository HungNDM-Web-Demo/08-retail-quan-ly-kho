using Application.Common.Exceptions;
using Application.Common.Models;
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

/// <summary>Phiếu xuất (UC-04, UC-05, UC-07; 07 §2.5, §3.4, §3.6, §3.8).</summary>
public sealed class GoodsIssueService(
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<Supplier> suppliers,
    IGenericRepository<Product> products,
    IUnitOfWork unitOfWork,
    IInventoryTransaction transaction,
    IWarehouseScope scope,
    IDocumentCodeGenerator codes,
    IStockPostingService posting,
    IStockQueries stockQueries,
    TimeProvider timeProvider) : IGoodsIssueService
{
    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<GoodsIssueListItem>> GetPagedAsync(GoodsIssueQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var source = issues.QueryNoTracking();
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
        if (query.CreatedById is { } createdById)
            source = source.Where(x => x.CreatedBy == createdById);
        if (DocumentSupport.ParseRange(query.From, query.To, required: false) is { } range)
            source = source.Where(x => (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) >= range.FromUtc
                && (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) < range.ToUtcExclusive);
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(x => AppDbFunctions.Matches(x.Code, pattern)
                || AppDbFunctions.Matches(x.RecipientName, pattern)
                || AppDbFunctions.Matches(x.OrderRef, pattern));
        }

        var page = await source.Include(x => x.Lines).AsSplitQuery().ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var context = await LoadContextAsync(page.Items, ct);
        return page.Map(items => items.Select(x => (GoodsIssueListItem)ToDto(x, actor, context, withLines: false, previews: null)).ToList());
    }

    public async Task<GoodsIssueDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var doc = await LoadAsync(id, tracking: false, ct);
        var context = await LoadContextAsync([doc], ct);
        DocumentSupport.EnsureScope(actor, doc.WarehouseId, context.Warehouses);

        Dictionary<Guid, ApprovalPreview>? previews = null;
        if (doc.Status == DocStatus.ChoDuyet && actor.Can(ProjectPermissions.GoodsIssues.Approve))
        {
            var book = await posting.LoadBookAsync(doc.Lines.Select(l => (doc.WarehouseId, l.ProductId)), ct);
            previews = StockChecks.Previews(book, doc.WarehouseId, doc.Lines, actor.CanViewValues);
        }

        return ToDto(doc, actor, context, withLines: true, previews);
    }

    public async Task<CreateResult<GoodsIssueDto>> CreateAsync(SaveGoodsIssueRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        if (request.Submit && !actor.Can(ProjectPermissions.GoodsIssues.Update))
            throw new ForbiddenException("Bạn không có quyền gửi duyệt phiếu xuất.");

        var (id, created) = await transaction.RunAsync(async token =>
        {
            var existing = await issues.QueryNoTracking().Where(x => x.ClientRequestId == request.ClientRequestId)
                .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(token);
            if (existing is { } existingId)
                return (existingId, false);

            var doc = new GoodsIssue
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
            await issues.AddAsync(doc, token);
            await unitOfWork.SaveChangesAsync(token);
            return (doc.Id, true);
        }, ct);

        return new CreateResult<GoodsIssueDto>(await GetAsync(id, ct), created);
    }

    public async Task<GoodsIssueDto> UpdateAsync(Guid id, SaveGoodsIssueRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, async (doc, token) =>
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

    public async Task<GoodsIssueDto> SubmitAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, async (doc, token) =>
        {
            Editable(doc);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var errors = new FieldErrorBag();
            await DocumentSupport.RequireWarehouseAsync(warehouses, doc.WarehouseId, actor, "warehouseId", errors, token);
            if (doc.Lines.Count == 0)
                errors.Add("lines", DocumentSupport.LinesRequired);
            ValidateSubmit(doc.Type, doc.RecipientName, doc.Reason, doc.SupplierId, errors);
            errors.ThrowIfAny();
            await SubmitCoreAsync(doc, token);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsIssueDto> WithdrawAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status == DocStatus.ChoDuyet);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            doc.Status = DocStatus.Nhap;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsIssueDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, async (doc, token) =>
        {
            EnsureStatus(doc, doc.Status == DocStatus.ChoDuyet);
            DocumentSupport.EnsureNotCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);

            var productIds = doc.Lines.Select(l => l.ProductId).Distinct().ToList();
            var book = await posting.LoadBookAsync(productIds.Select(p => (doc.WarehouseId, p)), token);
            StockChecks.EnsureOnHand(book, doc.WarehouseId, doc.Lines);
            var stocktakeLock = await stockQueries.FindLockAsync(doc.WarehouseId, productIds, token);
            if (stocktakeLock is not null)
                throw await GoodsReceiptService.CountingErrorAsync(warehouses, doc.WarehouseId, doc.Lines, stocktakeLock, token);

            var supplierName = doc.SupplierId is { } sid
                ? await suppliers.QueryNoTracking().IgnoreQueryFilters().Where(s => s.Id == sid).Select(s => s.Name).FirstOrDefaultAsync(token)
                : null;
            var originalCode = doc.ReversalOfReceiptId is { } rid
                ? await receipts.QueryNoTracking().Where(x => x.Id == rid).Select(x => x.Code).FirstOrDefaultAsync(token)
                : null;
            var now = Now;
            await posting.PostIssueAsync(book, doc, now, DocumentSupport.IssueDescription(doc, supplierName, originalCode), token);
            doc.Status = DocStatus.DaDuyet;
            doc.ApprovedById = actor.UserId;
            doc.ApprovedByName = actor.FullName;
            doc.ApprovedAt = now;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<GoodsIssueDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, (doc, _) =>
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

    public async Task<GoodsIssueDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status is DocStatus.Nhap or DocStatus.TuChoi);
            if (doc.CreatedBy != actor.UserId && !actor.Can(ProjectPermissions.GoodsIssues.Approve))
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

    /// <summary>BR-12, TC-20: phiếu nhập nháp loại Nhập điều chỉnh, đơn giá = giá vốn dòng gốc (quyết định 8).</summary>
    public async Task<CreateResult<Guid>> ReverseAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        var (receiptId, created) = await transaction.RunAsync(async token =>
        {
            var existing = await receipts.QueryNoTracking().Where(x => x.ClientRequestId == request.ClientRequestId)
                .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(token);
            if (existing is { } existingId)
                return (existingId, false);

            var doc = await LoadAsync(id, tracking: true, token);
            var names = await DocumentSupport.WarehousesAsync(warehouses, token);
            DocumentSupport.EnsureScope(actor, doc.WarehouseId, names);
            if (doc.Status != DocStatus.DaDuyet || doc.Type == IssueType.XuatDieuChinh)
                throw InventoryErrors.Business(InventoryErrors.KhongTaoPhieuNguoc, InventoryErrors.CannotReverseMessage);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var reversal = await receipts.QueryNoTracking()
                .Where(x => x.ReversalOfIssueId == doc.Id && x.Status != DocStatus.DaHuy)
                .Select(x => new { x.Code }).FirstOrDefaultAsync(token);
            if (reversal is not null)
                throw InventoryProblems.Coded(InventoryErrors.PhieuNguocDaCo, InventoryErrors.AlreadyReversed(doc.Code, reversal.Code));

            var receipt = new GoodsReceipt
            {
                WarehouseId = doc.WarehouseId,
                Type = ReceiptType.NhapDieuChinh,
                Note = $"Phiếu ngược của {doc.Code}",
                Status = DocStatus.Nhap,
                ReversalOfIssueId = doc.Id,
                CreatedBy = actor.UserId,
                CreatedByName = actor.FullName,
                ClientRequestId = request.ClientRequestId,
                LastRequestId = request.ClientRequestId,
                Lines = doc.Lines.OrderBy(l => l.LineNo).Select((l, i) => new GoodsReceiptLine
                {
                    LineNo = i + 1,
                    ProductId = l.ProductId,
                    ProductCode = l.ProductCode,
                    ProductName = l.ProductName,
                    BaseUnit = l.BaseUnit,
                    UnitName = l.BaseUnit,
                    Factor = 1,
                    Quantity = l.BaseQuantity,
                    BaseQuantity = l.BaseQuantity,
                    UnitPrice = l.UnitCost ?? 0
                }).ToList()
            };
            StockPosting.RecalculateReceipt(receipt);
            DocumentSupport.Touch(doc, doc.LastRequestId);
            await receipts.AddAsync(receipt, token);
            await unitOfWork.SaveChangesAsync(token);
            return (receipt.Id, true);
        }, ct);

        return new CreateResult<Guid>(receiptId, created);
    }

    private async Task ActAsync(Guid id, string? clientRequestId, InventoryActor actor, Func<GoodsIssue, CancellationToken, Task> action, CancellationToken ct)
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

    private async Task ApplyAsync(GoodsIssue doc, SaveGoodsIssueRequest request, InventoryActor actor, bool isNew, CancellationToken ct)
    {
        var errors = new FieldErrorBag();
        await DocumentSupport.RequireWarehouseAsync(warehouses, request.WarehouseId, actor, "warehouseId", errors, ct);

        var keepReversalType = !isNew && doc.Type == IssueType.XuatDieuChinh;
        var type = keepReversalType ? IssueType.XuatDieuChinh : request.Type;
        if (!keepReversalType && (!Enum.IsDefined(request.Type) || request.Type == IssueType.XuatDieuChinh))
            errors.Add("type", "Chọn loại xuất");
        if (request.SupplierId is { } supplierId && !await suppliers.AnyAsync(s => s.Id == supplierId, ct))
            errors.Add("supplierId", "Nhà cung cấp không tồn tại");

        var lines = await DocumentSupport.ResolveLinesAsync(products, request.Lines, request.Submit, errors, ct);
        if (request.Submit)
            ValidateSubmit(type, request.RecipientName, request.Reason, request.SupplierId, errors);
        errors.ThrowIfAny();

        doc.WarehouseId = request.WarehouseId;
        doc.Type = type;
        doc.RecipientName = DocumentSupport.Limit(request.RecipientName, 150);
        doc.SupplierId = request.SupplierId;
        doc.OrderRef = DocumentSupport.Limit(request.OrderRef, 30);
        doc.Reason = DocumentSupport.Limit(request.Reason, 300);

        doc.Lines.Clear();
        foreach (var resolved in lines)
        {
            var line = new GoodsIssueLine();
            resolved.FillTo(line, doc.Lines.Count + 1);
            doc.Lines.Add(line);
        }
    }

    private static void ValidateSubmit(IssueType type, string? recipient, string? reason, Guid? supplierId, FieldErrorBag errors)
    {
        if (type == IssueType.XuatBan && string.IsNullOrWhiteSpace(recipient))
            errors.Add("recipientName", "Nhập người nhận");
        if (type == IssueType.XuatHuy && string.IsNullOrWhiteSpace(reason))
            errors.Add("reason", "Nhập lý do xuất hủy");
        if (type == IssueType.XuatDieuChinh && string.IsNullOrWhiteSpace(reason))
            errors.Add("reason", "Nhập lý do xuất điều chỉnh");
        if (type == IssueType.TraNhaCungCap && supplierId is null)
            errors.Add("supplierId", "Chọn nhà cung cấp nhận hàng trả");
    }

    /// <summary>Gửi duyệt: kiểm tồn khả dụng (BR-04), cấp mã nếu chưa có, giữ chỗ.</summary>
    private async Task SubmitCoreAsync(GoodsIssue doc, CancellationToken ct)
    {
        await StockChecks.EnsureAvailableAsync(stockQueries, posting, doc.WarehouseId, doc.Lines, ct);
        var now = Now;
        doc.Code ??= await codes.NextAsync(InventoryRules.IssuePrefix, now, ct);
        doc.Status = DocStatus.ChoDuyet;
        doc.SubmittedAt = now;
    }

    private static void Editable(GoodsIssue doc) => EnsureStatus(doc, doc.Status is DocStatus.Nhap or DocStatus.TuChoi);

    private static void EnsureStatus(GoodsIssue doc, bool allowed) =>
        DocumentSupport.EnsureStatus(allowed, doc.Status == DocStatus.DaDuyet, doc, InventoryRules.Label(doc.Status), doc.Status.ToString());

    private async Task<GoodsIssue> LoadAsync(Guid id, bool tracking, CancellationToken ct)
    {
        var source = tracking ? issues.Query() : issues.QueryNoTracking();
        return await source.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu xuất.");
    }

    private sealed record DtoContext(
        Dictionary<Guid, Warehouse> Warehouses,
        Dictionary<Guid, Supplier> Suppliers,
        Dictionary<Guid, string?> ReversalOfCodes,
        Dictionary<Guid, (Guid Id, string? Code)> ReversedBy);

    private async Task<DtoContext> LoadContextAsync(IReadOnlyCollection<GoodsIssue> docs, CancellationToken ct)
    {
        var ids = docs.Select(d => d.Id).ToList();
        var originIds = docs.Where(d => d.ReversalOfReceiptId != null).Select(d => d.ReversalOfReceiptId!.Value).ToList();
        var origins = await receipts.QueryNoTracking().Where(x => originIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Code, ct);
        var reversed = await receipts.QueryNoTracking()
            .Where(x => x.ReversalOfIssueId != null && ids.Contains(x.ReversalOfIssueId.Value) && x.Status != DocStatus.DaHuy)
            .Select(x => new { Origin = x.ReversalOfIssueId!.Value, x.Id, x.Code })
            .ToListAsync(ct);
        return new DtoContext(
            await DocumentSupport.WarehousesAsync(warehouses, ct),
            await DocumentSupport.SuppliersAsync(suppliers, ct),
            origins,
            reversed.GroupBy(x => x.Origin).ToDictionary(g => g.Key, g => (g.First().Id, g.First().Code)));
    }

    private static GoodsIssueDto ToDto(
        GoodsIssue x, InventoryActor actor, DtoContext context, bool withLines, Dictionary<Guid, ApprovalPreview>? previews)
    {
        var canView = actor.CanViewValues;
        var warehouse = context.Warehouses.GetValueOrDefault(x.WarehouseId);
        var supplier = x.SupplierId is { } sid ? context.Suppliers.GetValueOrDefault(sid) : null;
        var reversedBy = context.ReversedBy.TryGetValue(x.Id, out var r) ? r : ((Guid Id, string? Code)?)null;
        return new GoodsIssueDto
        {
            Id = x.Id,
            Code = x.Code,
            WarehouseId = x.WarehouseId,
            WarehouseCode = warehouse?.Code ?? string.Empty,
            WarehouseName = warehouse?.Name ?? string.Empty,
            Type = x.Type,
            RecipientName = x.RecipientName,
            SupplierId = x.SupplierId,
            SupplierCode = supplier?.Code,
            SupplierName = supplier?.Name,
            OrderRef = x.OrderRef,
            Reason = x.Reason,
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
            ReversalOfId = x.ReversalOfReceiptId,
            ReversalOfCode = x.ReversalOfReceiptId is { } oid ? context.ReversalOfCodes.GetValueOrDefault(oid) : null,
            ReversedById = reversedBy?.Id,
            ReversedByCode = reversedBy?.Code,
            LineCount = x.Lines.Count,
            CanViewValues = canView,
            Lines = withLines
                ? x.Lines.OrderBy(l => l.LineNo).Select(l => new GoodsIssueLineDto
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
                    UnitCost = canView ? l.UnitCost : null,
                    Value = canView ? l.Value : null,
                    Preview = previews?.GetValueOrDefault(l.Id)
                }).ToList()
                : []
        };
    }
}
