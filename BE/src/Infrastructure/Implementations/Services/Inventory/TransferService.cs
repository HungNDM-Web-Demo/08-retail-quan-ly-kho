using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Enums.Inventory;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Chuyển kho (UC-06; 07 §2.6, §3.5, §3.8): duyệt trừ kho đi, nhận cộng kho đến, hao hụt ghi ở phiếu.</summary>
public sealed class TransferService(
    IGenericRepository<Transfer> transfers,
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<Product> products,
    IUnitOfWork unitOfWork,
    IInventoryTransaction transaction,
    IWarehouseScope scope,
    IDocumentCodeGenerator codes,
    IStockPostingService posting,
    IStockQueries stockQueries,
    TimeProvider timeProvider) : ITransferService
{
    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<TransferListItem>> GetPagedAsync(TransferQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var source = transfers.QueryNoTracking();
        if (!actor.AllWarehouses)
        {
            var scopeIds = actor.AssignedWarehouseIds.ToList();
            source = source.Where(x => scopeIds.Contains(x.FromWarehouseId) || scopeIds.Contains(x.ToWarehouseId));
        }

        if (query.WarehouseId is { } warehouseId && actor.InScope(warehouseId))
            source = source.Where(x => x.FromWarehouseId == warehouseId || x.ToWarehouseId == warehouseId);
        if (query.FromWarehouseId is { } fromId)
            source = source.Where(x => x.FromWarehouseId == fromId);
        if (query.ToWarehouseId is { } toId)
            source = source.Where(x => x.ToWarehouseId == toId);
        if (query.Status is { } status)
            source = source.Where(x => x.Status == status);
        if (query.IsLate == true)
        {
            var lateBefore = Now.AddDays(-InventoryRules.LateDays);
            source = source.Where(x => x.Status == TransferStatus.DangChuyen && x.ApprovedAt < lateBefore);
        }

        if (query.CreatedById is { } createdById)
            source = source.Where(x => x.CreatedBy == createdById);
        if (DocumentSupport.ParseRange(query.From, query.To, required: false) is { } range)
            source = source.Where(x => (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) >= range.FromUtc
                && (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) < range.ToUtcExclusive);
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(x => AppDbFunctions.Matches(x.Code, pattern) || AppDbFunctions.Matches(x.Note, pattern));
        }

        var page = await source.Include(x => x.Lines).AsSplitQuery().ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var names = await DocumentSupport.WarehousesAsync(warehouses, ct);
        return page.Map(items => items.Select(x => (TransferListItem)ToDto(x, actor, names, false, null)).ToList());
    }

    public async Task<TransferDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var doc = await LoadAsync(id, tracking: false, ct);
        var names = await DocumentSupport.WarehousesAsync(warehouses, ct);
        if (!actor.InScope(doc.FromWarehouseId) && !actor.InScope(doc.ToWarehouseId))
            throw InventoryProblems.NotKeeper(names.GetValueOrDefault(doc.FromWarehouseId)?.Code ?? string.Empty);

        Dictionary<Guid, ApprovalPreview>? previews = null;
        if (doc.Status == TransferStatus.ChoDuyet && actor.Can(ProjectPermissions.Transfers.Approve))
        {
            var book = await posting.LoadBookAsync(doc.Lines.Select(l => (doc.FromWarehouseId, l.ProductId)), ct);
            previews = StockChecks.Previews(book, doc.FromWarehouseId, doc.Lines, actor.CanViewValues);
        }

        return ToDto(doc, actor, names, true, previews);
    }

    public async Task<CreateResult<TransferDto>> CreateAsync(SaveTransferRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        if (request.Submit && !actor.Can(ProjectPermissions.Transfers.Update))
            throw new ForbiddenException("Bạn không có quyền gửi duyệt phiếu chuyển kho.");

        var (id, created) = await transaction.RunAsync(async token =>
        {
            var existing = await transfers.QueryNoTracking().Where(x => x.ClientRequestId == request.ClientRequestId)
                .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(token);
            if (existing is { } existingId)
                return (existingId, false);

            var doc = new Transfer
            {
                Status = TransferStatus.Nhap,
                CreatedBy = actor.UserId,
                CreatedByName = actor.FullName,
                ClientRequestId = request.ClientRequestId,
                LastRequestId = request.ClientRequestId
            };
            await ApplyAsync(doc, request, actor, token);
            if (request.Submit)
                await SubmitCoreAsync(doc, token);
            await transfers.AddAsync(doc, token);
            await unitOfWork.SaveChangesAsync(token);
            return (doc.Id, true);
        }, ct);

        return new CreateResult<TransferDto>(await GetAsync(id, ct), created);
    }

    public async Task<TransferDto> UpdateAsync(Guid id, SaveTransferRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, receiving: false, async (doc, token) =>
        {
            Editable(doc);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            await ApplyAsync(doc, request, actor, token);
            if (request.Submit)
                await SubmitCoreAsync(doc, token);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<TransferDto> SubmitAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, receiving: false, async (doc, token) =>
        {
            Editable(doc);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var errors = new FieldErrorBag();
            await ValidateWarehousesAsync(doc.FromWarehouseId, doc.ToWarehouseId, actor, errors, token);
            if (doc.Lines.Count == 0)
                errors.Add("lines", DocumentSupport.LinesRequired);
            errors.ThrowIfAny();
            await SubmitCoreAsync(doc, token);
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<TransferDto> WithdrawAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, receiving: false, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status == TransferStatus.ChoDuyet);
            DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            doc.Status = TransferStatus.Nhap;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<TransferDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, receiving: false, async (doc, token) =>
        {
            EnsureStatus(doc, doc.Status == TransferStatus.ChoDuyet);
            DocumentSupport.EnsureNotCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);

            var productIds = doc.Lines.Select(l => l.ProductId).Distinct().ToList();
            var book = await posting.LoadBookAsync(productIds.Select(p => (doc.FromWarehouseId, p)), token);
            StockChecks.EnsureOnHand(book, doc.FromWarehouseId, doc.Lines);
            var stocktakeLock = await stockQueries.FindLockAsync(doc.FromWarehouseId, productIds, token);
            if (stocktakeLock is not null)
                throw await GoodsReceiptService.CountingErrorAsync(warehouses, doc.FromWarehouseId, doc.Lines, stocktakeLock, token);

            var names = await DocumentSupport.WarehousesAsync(warehouses, token);
            var to = names[doc.ToWarehouseId];
            var now = Now;
            await posting.PostTransferOutAsync(book, doc, now, $"Chuyển đến {to.Code} – {to.Name}", token);
            doc.Status = TransferStatus.DangChuyen;
            doc.ApprovedById = actor.UserId;
            doc.ApprovedByName = actor.FullName;
            doc.ApprovedAt = now;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<TransferDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, receiving: false, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status == TransferStatus.ChoDuyet);
            DocumentSupport.EnsureNotCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var reason = DocumentSupport.RequireRejectReason(request.Reason);
            doc.Status = TransferStatus.TuChoi;
            doc.RejectedById = actor.UserId;
            doc.RejectedByName = actor.FullName;
            doc.RejectedAt = Now;
            doc.RejectReason = reason;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<TransferDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, receiving: false, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status is TransferStatus.Nhap or TransferStatus.TuChoi);
            if (doc.CreatedBy != actor.UserId && !actor.Can(ProjectPermissions.Transfers.Approve))
                DocumentSupport.EnsureCreator(doc, actor);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            doc.Status = TransferStatus.DaHuy;
            doc.CancelledById = actor.UserId;
            doc.CancelledByName = actor.FullName;
            doc.CancelledAt = Now;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    /// <summary>UC-06 bước 4: nhập số thực nhận mọi dòng (0…số chuyển), cộng kho đến, ghi hao hụt.</summary>
    public async Task<TransferDto> ReceiveAsync(Guid id, ReceiveTransferRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, receiving: true, async (doc, token) =>
        {
            if (doc.Status != TransferStatus.DangChuyen)
            {
                throw InventoryErrors.Business(InventoryErrors.TrangThaiKhongHopLe,
                    InventoryErrors.InvalidStatus(InventoryRules.Label(doc.Status)),
                    new Dictionary<string, object?> { ["docStatus"] = doc.Status.ToString() });
            }

            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var errors = new FieldErrorBag();
            var lines = doc.Lines.OrderBy(l => l.LineNo).ToList();
            var byId = request.Lines.GroupBy(l => l.LineId).ToDictionary(g => g.Key, g => g.First().ReceivedBaseQuantity);
            if (lines.Any(l => !byId.ContainsKey(l.Id)))
                errors.Add("lines", "Nhập số thực nhận cho mọi dòng");
            for (var i = 0; i < lines.Count; i++)
            {
                if (byId.TryGetValue(lines[i].Id, out var received) && (received < 0 || received > lines[i].BaseQuantity))
                {
                    errors.Add($"lines[{i}].receivedBaseQuantity",
                        $"Không vượt số lượng chuyển {InventoryRules.Number(lines[i].BaseQuantity)} {lines[i].BaseUnit.ToLowerInvariant()}");
                }
            }

            errors.ThrowIfAny();
            foreach (var line in lines)
                line.ReceivedBaseQuantity = byId[line.Id];

            var productIds = lines.Where(l => l.ReceivedBaseQuantity > 0).Select(l => l.ProductId).Distinct().ToList();
            var stocktakeLock = await stockQueries.FindLockAsync(doc.ToWarehouseId, productIds, token);
            if (stocktakeLock is not null)
                throw await GoodsReceiptService.CountingErrorAsync(warehouses, doc.ToWarehouseId, lines, stocktakeLock, token);

            var names = await DocumentSupport.WarehousesAsync(warehouses, token);
            var from = names[doc.FromWarehouseId];
            var book = await posting.LoadBookAsync(lines.Select(l => (doc.ToWarehouseId, l.ProductId)), token);
            var now = Now;
            await posting.PostTransferInAsync(book, doc, now, $"Nhận từ {from.Code} – {from.Name}", token);
            doc.Status = TransferStatus.DaNhan;
            doc.ReceivedById = actor.UserId;
            doc.ReceivedByName = actor.FullName;
            doc.ReceivedAt = now;
        }, ct);
        return await GetAsync(id, ct);
    }

    private async Task ActAsync(
        Guid id, string? clientRequestId, InventoryActor actor, bool receiving, Func<Transfer, CancellationToken, Task> action, CancellationToken ct)
    {
        DocumentSupport.RequireClientRequestId(clientRequestId);
        await transaction.RunAsync(async token =>
        {
            var doc = await LoadAsync(id, tracking: true, token);
            var names = await DocumentSupport.WarehousesAsync(warehouses, token);
            if (receiving)
            {
                if (!actor.InScope(doc.ToWarehouseId))
                    throw InventoryProblems.NotReceiver(names.GetValueOrDefault(doc.ToWarehouseId)?.Code ?? string.Empty);
            }
            else
            {
                DocumentSupport.EnsureScope(actor, doc.FromWarehouseId, names);
            }

            if (doc.LastRequestId == clientRequestId)
                return true;

            await action(doc, token);
            DocumentSupport.Touch(doc, clientRequestId);
            await unitOfWork.SaveChangesAsync(token);
            return true;
        }, ct);
    }

    private async Task ValidateWarehousesAsync(Guid fromId, Guid toId, InventoryActor actor, FieldErrorBag errors, CancellationToken ct)
    {
        await DocumentSupport.RequireWarehouseAsync(warehouses, fromId, actor, "fromWarehouseId", errors, ct);
        if (toId == fromId)
        {
            errors.Add("toWarehouseId", "Kho đến phải khác kho đi");
            return;
        }

        var to = await warehouses.QueryNoTracking().FirstOrDefaultAsync(w => w.Id == toId, ct);
        if (to is null)
            errors.Add("toWarehouseId", "Chọn kho đến");
        else if (!to.IsActive)
            errors.Add("toWarehouseId", $"Kho {to.Code} đã ngừng hoạt động");
    }

    private async Task ApplyAsync(Transfer doc, SaveTransferRequest request, InventoryActor actor, CancellationToken ct)
    {
        var errors = new FieldErrorBag();
        await ValidateWarehousesAsync(request.FromWarehouseId, request.ToWarehouseId, actor, errors, ct);
        var lines = await DocumentSupport.ResolveLinesAsync(products, request.Lines, request.Submit, errors, ct);
        errors.ThrowIfAny();

        doc.FromWarehouseId = request.FromWarehouseId;
        doc.ToWarehouseId = request.ToWarehouseId;
        doc.Note = DocumentSupport.Limit(request.Note, 500);
        doc.Lines.Clear();
        foreach (var resolved in lines)
        {
            var line = new TransferLine();
            resolved.FillTo(line, doc.Lines.Count + 1);
            doc.Lines.Add(line);
        }
    }

    private async Task SubmitCoreAsync(Transfer doc, CancellationToken ct)
    {
        await StockChecks.EnsureAvailableAsync(stockQueries, posting, doc.FromWarehouseId, doc.Lines, ct);
        var now = Now;
        doc.Code ??= await codes.NextAsync(InventoryRules.TransferPrefix, now, ct);
        doc.Status = TransferStatus.ChoDuyet;
        doc.SubmittedAt = now;
    }

    private static void Editable(Transfer doc) => EnsureStatus(doc, doc.Status is TransferStatus.Nhap or TransferStatus.TuChoi);

    private static void EnsureStatus(Transfer doc, bool allowed) =>
        DocumentSupport.EnsureStatus(allowed, doc.Status is TransferStatus.DangChuyen or TransferStatus.DaNhan, doc,
            InventoryRules.Label(doc.Status), doc.Status.ToString());

    private async Task<Transfer> LoadAsync(Guid id, bool tracking, CancellationToken ct)
    {
        var source = tracking ? transfers.Query() : transfers.QueryNoTracking();
        return await source.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu chuyển kho.");
    }

    private TransferDto ToDto(
        Transfer x, InventoryActor actor, Dictionary<Guid, Warehouse> names, bool withLines, Dictionary<Guid, ApprovalPreview>? previews)
    {
        var canView = actor.CanViewValues;
        var from = names.GetValueOrDefault(x.FromWarehouseId);
        var to = names.GetValueOrDefault(x.ToWarehouseId);
        return new TransferDto
        {
            Id = x.Id,
            Code = x.Code,
            FromWarehouseId = x.FromWarehouseId,
            FromWarehouseCode = from?.Code ?? string.Empty,
            FromWarehouseName = from?.Name ?? string.Empty,
            ToWarehouseId = x.ToWarehouseId,
            ToWarehouseCode = to?.Code ?? string.Empty,
            ToWarehouseName = to?.Name ?? string.Empty,
            Note = x.Note,
            Status = x.Status,
            IsLate = x.Status == TransferStatus.DangChuyen && x.ApprovedAt is { } at && StockMath.IsLate(at, Now),
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
            ReceivedById = x.ReceivedById,
            ReceivedByName = x.ReceivedByName,
            ReceivedAt = x.ReceivedAt,
            TotalValue = canView ? x.TotalValue : null,
            ShortageValue = canView ? x.ShortageValue : null,
            LineCount = x.Lines.Count,
            CanViewValues = canView,
            Lines = withLines
                ? x.Lines.OrderBy(l => l.LineNo).Select(l => new TransferLineDto
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
                    ReceivedBaseQuantity = l.ReceivedBaseQuantity,
                    ShortageQuantity = l.ShortageQuantity,
                    UnitCost = canView ? l.UnitCost : null,
                    Value = canView ? l.Value : null,
                    ShortageValue = canView ? l.ShortageValue : null,
                    Preview = previews?.GetValueOrDefault(l.Id)
                }).ToList()
                : []
        };
    }
}
