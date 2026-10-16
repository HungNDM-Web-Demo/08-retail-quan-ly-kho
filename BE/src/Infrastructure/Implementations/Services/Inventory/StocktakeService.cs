using System.Text.Json;
using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Warehouses;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Kiểm kê (UC-11; BR-14…BR-17; 07 §2.9, §3.7): chốt sổ sách, đếm mù, chênh lệch, cân bằng.</summary>
public sealed class StocktakeService(
    IGenericRepository<Stocktake> stocktakes,
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<Product> products,
    IGenericRepository<ProductGroup> groups,
    IGenericRepository<StockLevel> levels,
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    IInventoryTransaction transaction,
    IWarehouseScope scope,
    IDocumentCodeGenerator codes,
    IStockPostingService posting,
    TimeProvider timeProvider) : IStocktakeService
{
    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<PaginatedResult<StocktakeListItem>> GetPagedAsync(StocktakeQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var source = stocktakes.QueryNoTracking();
        if (!actor.AllWarehouses)
        {
            var scopeIds = actor.AssignedWarehouseIds.ToList();
            source = source.Where(x => scopeIds.Contains(x.WarehouseId));
        }

        if (query.WarehouseId is { } warehouseId && actor.InScope(warehouseId))
            source = source.Where(x => x.WarehouseId == warehouseId);
        if (query.Status is { } status)
            source = source.Where(x => x.Status == status);
        if (DocumentSupport.ParseRange(query.From, query.To, required: false) is { } range)
            source = source.Where(x => (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) >= range.FromUtc
                && (x.ApprovedAt ?? x.SubmittedAt ?? x.CreatedAt) < range.ToUtcExclusive);
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(x => AppDbFunctions.Matches(x.Code, pattern) || AppDbFunctions.Matches(x.Note, pattern));
        }

        var page = await source.Include(x => x.Lines).AsSplitQuery().ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var context = await LoadContextAsync(page.Items, withUnits: false, ct);
        return page.Map(items => items.Select(x => (StocktakeListItem)ToDto(x, actor, context, withLines: false)).ToList());
    }

    public async Task<StocktakeDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var doc = await LoadAsync(id, tracking: false, ct);
        var context = await LoadContextAsync([doc], withUnits: true, ct);
        DocumentSupport.EnsureScope(actor, doc.WarehouseId, context.Warehouses);
        return ToDto(doc, actor, context, withLines: true);
    }

    public async Task<CreateResult<StocktakeDto>> CreateAsync(CreateStocktakeRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        var (id, created) = await transaction.RunAsync(async token =>
        {
            var existing = await stocktakes.QueryNoTracking().Where(x => x.ClientRequestId == request.ClientRequestId)
                .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(token);
            if (existing is { } existingId)
                return (existingId, false);

            var errors = new FieldErrorBag();
            var warehouse = await DocumentSupport.RequireWarehouseAsync(warehouses, request.WarehouseId, actor, "warehouseId", errors, token);
            var groupIds = request.GroupIds.Distinct().ToList();
            if (!request.ScopeAll && groupIds.Count == 0)
                errors.Add("groupIds", "Chọn ít nhất một nhóm hàng");
            var keeperIds = await warehouses.QueryNoTracking().Where(w => w.Id == warehouse.Id)
                .SelectMany(w => w.Keepers.Select(k => k.UserId)).ToListAsync(token);
            if (request.CounterId != actor.UserId && !keeperIds.Contains(request.CounterId))
                errors.Add("counterId", $"Người đếm phải là thủ kho phụ trách kho {warehouse.Code}");
            errors.ThrowIfAny();

            await transaction.LockWarehouseAsync(warehouse.Id, token);
            var open = await stocktakes.QueryNoTracking()
                .Where(s => s.WarehouseId == warehouse.Id && (s.Status == StocktakeStatus.DangKiem || s.Status == StocktakeStatus.ChoDuyet))
                .Select(s => new { s.Id, s.Code }).FirstOrDefaultAsync(token);
            if (open is not null)
            {
                throw InventoryProblems.Coded(InventoryErrors.KhoDaCoPhieuKiemKe,
                    InventoryErrors.WarehouseHasStocktake(warehouse.Code, open.Code), null,
                    new Dictionary<string, object?> { ["stocktakeId"] = open.Id });
            }

            var counterName = await users.QueryNoTracking().Where(u => u.Id == request.CounterId)
                .Select(u => u.FullName).FirstOrDefaultAsync(token) ?? actor.FullName;
            var now = Now;
            var doc = new Stocktake
            {
                Code = await codes.NextAsync(InventoryRules.StocktakePrefix, now, token),
                WarehouseId = warehouse.Id,
                ScopeAll = request.ScopeAll,
                ScopeGroupIds = request.ScopeAll ? null : JsonSerializer.Serialize(groupIds),
                Status = StocktakeStatus.DangKiem,
                SnapshotAt = now,
                CreatedBy = actor.UserId,
                CreatedByName = actor.FullName,
                CounterId = request.CounterId,
                CounterName = counterName,
                Note = DocumentSupport.Limit(request.Note, 500),
                ClientRequestId = request.ClientRequestId,
                LastRequestId = request.ClientRequestId,
                Lines = await SnapshotLinesAsync(warehouse.Id, request.ScopeAll, groupIds, token)
            };
            if (doc.Lines.Count == 0)
                throw InventoryErrors.Business(InventoryErrors.KhongCoHangKiemKe, InventoryErrors.NoStocktakeItemsMessage);

            await stocktakes.AddAsync(doc, token);
            await unitOfWork.SaveChangesAsync(token);
            return (doc.Id, true);
        }, ct);

        return new CreateResult<StocktakeDto>(await GetAsync(id, ct), created);
    }

    /// <summary>Dòng = mặt hàng thuộc phạm vi có tồn ≠ 0 tại kho, xếp (thứ tự nhóm, mã hàng) (07 §3.7, 06 §5.4 bước 7).</summary>
    internal async Task<List<StocktakeLine>> SnapshotLinesAsync(Guid warehouseId, bool scopeAll, IReadOnlyCollection<Guid> groupIds, CancellationToken ct)
    {
        var rows = await levels.QueryNoTracking()
            .Where(l => l.WarehouseId == warehouseId && l.OnHand != 0)
            .Join(products.QueryNoTracking(), l => l.ProductId, p => p.Id, (l, p) => new { Level = l, Product = p })
            .Where(x => scopeAll || groupIds.Contains(x.Product.GroupId))
            .Select(x => new
            {
                x.Level.ProductId,
                x.Product.Code,
                x.Product.Name,
                x.Product.GroupId,
                GroupName = x.Product.Group!.Name,
                GroupOrder = x.Product.Group!.SortOrder,
                x.Product.BaseUnit,
                x.Level.OnHand,
                x.Level.AvgCost
            })
            .ToListAsync(ct);

        return rows
            .OrderBy(r => r.GroupOrder).ThenBy(r => r.Code, StringComparer.Ordinal)
            .Select((r, i) => new StocktakeLine
            {
                ProductId = r.ProductId,
                ProductCode = r.Code,
                ProductName = r.Name,
                GroupId = r.GroupId,
                GroupName = r.GroupName,
                BaseUnit = r.BaseUnit,
                BookQuantity = r.OnHand,
                BookCost = r.AvgCost,
                SortOrder = i + 1
            })
            .ToList();
    }

    public async Task<StocktakeDto> SubmitCountsAsync(Guid id, SubmitCountsRequest request, CancellationToken ct = default)
    {
        DocumentSupport.RequireClientRequestId(request.ClientRequestId);
        var actor = await scope.GetActorAsync(ct);
        await transaction.RunAsync(async token =>
        {
            var doc = await LoadAsync(id, tracking: true, token);
            var names = await DocumentSupport.WarehousesAsync(warehouses, token);
            DocumentSupport.EnsureScope(actor, doc.WarehouseId, names);
            if (doc.Counts.Any(c => c.ClientRequestId == request.ClientRequestId))
                return true;
            EnsureStatus(doc, doc.Status == StocktakeStatus.DangKiem);

            var errors = new FieldErrorBag();
            var ids = request.Entries.Select(e => e.ProductId).Distinct().ToList();
            var found = await products.QueryNoTracking().Include(p => p.Units).Include(p => p.Group)
                .Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, token);
            var scopeGroups = StockQueries.ParseGroupIds(doc.ScopeGroupIds);
            string? outOfScope = null;
            for (var i = 0; i < request.Entries.Count; i++)
            {
                var entry = request.Entries[i];
                if (!found.TryGetValue(entry.ProductId, out var product))
                {
                    errors.Add($"entries[{i}].productId", "Mặt hàng không tồn tại");
                    continue;
                }

                var inScope = doc.ScopeAll || scopeGroups.Contains(product.GroupId) || doc.Lines.Any(l => l.ProductId == product.Id);
                if (!inScope)
                {
                    var message = InventoryErrors.OutOfStocktakeScope(product.Name);
                    outOfScope ??= message;
                    errors.Add($"entries[{i}].productId", message);
                }

                if (entry.Quantity < 0)
                    errors.Add($"entries[{i}].quantity", "Số lượng phải là số nguyên không âm");
                if (entry.UnitId is { } unitId && product.Units.All(u => u.Id != unitId))
                    errors.Add($"entries[{i}].unitId", "Đơn vị không thuộc mặt hàng");
            }

            if (outOfScope is not null)
                throw InventoryErrors.WithErrors(InventoryErrors.NgoaiPhamViKiemKe, outOfScope, errors.ToDictionary());
            errors.ThrowIfAny();

            var stockByProduct = await levels.QueryNoTracking().Where(l => l.WarehouseId == doc.WarehouseId && ids.Contains(l.ProductId))
                .ToDictionaryAsync(l => l.ProductId, token);
            var now = Now;
            foreach (var entry in request.Entries)
            {
                var product = found[entry.ProductId];
                var line = doc.Lines.FirstOrDefault(l => l.ProductId == product.Id);
                if (line is null)
                {
                    line = new StocktakeLine
                    {
                        ProductId = product.Id,
                        ProductCode = product.Code,
                        ProductName = product.Name,
                        GroupId = product.GroupId,
                        GroupName = product.Group?.Name ?? string.Empty,
                        BaseUnit = product.BaseUnit,
                        BookQuantity = 0,
                        BookCost = stockByProduct.GetValueOrDefault(product.Id)?.AvgCost ?? 0,
                        IsAdded = true,
                        SortOrder = doc.Lines.Count == 0 ? 1 : doc.Lines.Max(l => l.SortOrder) + 1
                    };
                    doc.Lines.Add(line);
                }

                var factor = entry.UnitId is { } unitId ? product.Units.First(u => u.Id == unitId).Factor : 1;
                var quantity = StockMath.ToBase(entry.Quantity, factor);
                line.CountedQuantity = entry.Mode == CountMode.Cong ? (line.CountedQuantity ?? 0) + quantity : quantity;
                line.NeedsRecount = false;
                line.LastCountedById = actor.UserId;
                line.LastCountedByName = actor.FullName;
                line.LastCountedAt = now;
                ApplyVariance(line, stockByProduct.GetValueOrDefault(line.ProductId)?.StockValue ?? 0);
            }

            doc.Counts.Add(new StocktakeCount
            {
                ClientRequestId = request.ClientRequestId,
                Entries = JsonSerializer.Serialize(request.Entries, JsonOptions),
                CountedById = actor.UserId,
                CountedByName = actor.FullName
            });
            await unitOfWork.SaveChangesAsync(token);
            return true;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<StocktakeDto> FillUncountedAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, async (doc, token) =>
        {
            EnsureStatus(doc, doc.Status == StocktakeStatus.DangKiem);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var stock = await StockValuesAsync(doc, token);
            var now = Now;
            foreach (var line in doc.Lines.Where(l => l.CountedQuantity is null))
            {
                line.CountedQuantity = line.BookQuantity;
                line.NeedsRecount = false;
                line.LastCountedById = actor.UserId;
                line.LastCountedByName = actor.FullName;
                line.LastCountedAt = now;
                ApplyVariance(line, stock.GetValueOrDefault(line.ProductId));
            }
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<StocktakeDto> SubmitAsync(Guid id, SubmitStocktakeRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, async (doc, token) =>
        {
            EnsureStatus(doc, doc.Status == StocktakeStatus.DangKiem);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);

            var uncounted = doc.Lines.Where(l => l.CountedQuantity is null).OrderBy(l => l.SortOrder).ToList();
            if (uncounted.Count > 0)
            {
                throw InventoryErrors.Business(InventoryErrors.ConDongChuaDem, InventoryErrors.Uncounted(uncounted.Count),
                    new Dictionary<string, object?> { ["uncountedLineIds"] = uncounted.Select(l => l.Id).ToList() });
            }

            var stock = await StockValuesAsync(doc, token);
            foreach (var line in doc.Lines)
                ApplyVariance(line, stock.GetValueOrDefault(line.ProductId));

            var errors = new FieldErrorBag();
            for (var i = 0; i < request.Reasons.Count; i++)
            {
                var input = request.Reasons[i];
                var line = doc.Lines.FirstOrDefault(l => l.Id == input.LineId);
                if (line is null)
                {
                    errors.Add($"reasons[{i}].lineId", "Dòng kiểm kê không tồn tại");
                    continue;
                }

                if (input.Reason == VarianceReason.Khac && string.IsNullOrWhiteSpace(input.Note))
                    errors.Add($"reasons[{i}].note", "Nhập ghi chú cho nguyên nhân Khác");
                line.Reason = input.Reason;
                line.ReasonNote = DocumentSupport.Limit(input.Note, 300);
            }

            errors.ThrowIfAny();
            var missing = doc.Lines.Where(l => l.ReasonRequired && l.Reason is null).OrderBy(l => l.SortOrder).ToList();
            if (missing.Count > 0)
            {
                var canView = actor.CanViewValues;
                throw InventoryErrors.Business(InventoryErrors.ThieuNguyenNhan, InventoryErrors.MissingReasons(missing.Count),
                    new Dictionary<string, object?>
                    {
                        ["requiredLines"] = missing.Select(l => new
                        {
                            lineId = l.Id,
                            productName = l.ProductName,
                            difference = l.Difference,
                            differencePercent = StockMath.DifferencePercent(l.BookQuantity, l.Difference),
                            differenceValue = canView ? l.DifferenceValue : null
                        }).ToList()
                    });
            }

            Totals(doc);
            doc.Status = StocktakeStatus.ChoDuyet;
            doc.SubmittedById = actor.UserId;
            doc.SubmittedByName = actor.FullName;
            doc.SubmittedAt = Now;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<StocktakeDto> ApproveAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, async (doc, token) =>
        {
            EnsureStatus(doc, doc.Status == StocktakeStatus.ChoDuyet);
            if (doc.CounterId == actor.UserId || doc.Counts.Any(c => c.CountedById == actor.UserId))
                throw InventoryErrors.Business(InventoryErrors.NguoiDuyetTrungNguoiLap, InventoryErrors.SameCounterMessage);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);

            var book = await posting.LoadBookAsync(doc.Lines.Select(l => (doc.WarehouseId, l.ProductId)), token);
            foreach (var line in doc.Lines)
                ApplyVariance(line, book.Find(doc.WarehouseId, line.ProductId)?.StockValue ?? 0);
            Totals(doc);
            var now = Now;
            await posting.PostStocktakeAsync(book, doc, now, token);
            doc.Status = StocktakeStatus.DaCanBang;
            doc.ApprovedById = actor.UserId;
            doc.ApprovedByName = actor.FullName;
            doc.ApprovedAt = now;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<StocktakeDto> ReturnAsync(Guid id, ReturnStocktakeRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status == StocktakeStatus.ChoDuyet);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            var errors = new FieldErrorBag();
            var selected = doc.Lines.Where(l => request.LineIds.Contains(l.Id)).ToList();
            if (selected.Count == 0)
                errors.Add("lineIds", "Chọn ít nhất một dòng cần đếm lại");
            if (string.IsNullOrWhiteSpace(request.Note))
                errors.Add("note", "Nhập ghi chú cho người đếm");
            errors.ThrowIfAny();

            var note = DocumentSupport.Limit(request.Note, 300);
            foreach (var line in selected)
            {
                line.NeedsRecount = true;
                line.RecountNote = note;
                line.CountedQuantity = null;
                line.Difference = null;
                line.DifferenceValue = null;
                line.ReasonRequired = false;
                line.Reason = null;
                line.ReasonNote = null;
            }

            doc.ReturnNote = DocumentSupport.Limit(request.Note, 500);
            doc.Status = StocktakeStatus.DangKiem;
            Totals(doc);
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    public async Task<StocktakeDto> CancelAsync(Guid id, DocActionRequest request, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        await ActAsync(id, request.ClientRequestId, actor, (doc, _) =>
        {
            EnsureStatus(doc, doc.Status is StocktakeStatus.DangKiem or StocktakeStatus.ChoDuyet);
            DocumentSupport.EnsureVersion(doc.Version, request.Version);
            doc.Status = StocktakeStatus.DaHuy;
            doc.CancelledById = actor.UserId;
            doc.CancelledByName = actor.FullName;
            doc.CancelledAt = Now;
            return Task.CompletedTask;
        }, ct);
        return await GetAsync(id, ct);
    }

    /// <summary>BR-16: chênh lệch, giá trị, bắt buộc nguyên nhân; chưa đếm thì xóa số chênh.</summary>
    internal static void ApplyVariance(StocktakeLine line, decimal currentStockValue)
    {
        if (line.CountedQuantity is not { } counted)
        {
            line.Difference = null;
            line.DifferenceValue = null;
            line.ReasonRequired = false;
            return;
        }

        var variance = StockMath.VarianceOf(line.BookQuantity, counted, line.BookCost, currentStockValue);
        line.Difference = variance.Difference;
        line.DifferenceValue = variance.Value;
        line.ReasonRequired = variance.ReasonRequired;
    }

    internal static void Totals(Stocktake doc)
    {
        doc.SurplusValue = doc.Lines.Where(l => l.DifferenceValue > 0).Sum(l => l.DifferenceValue ?? 0);
        doc.ShortageValue = doc.Lines.Where(l => l.DifferenceValue < 0).Sum(l => -(l.DifferenceValue ?? 0));
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private async Task<Dictionary<Guid, decimal>> StockValuesAsync(Stocktake doc, CancellationToken ct)
    {
        var ids = doc.Lines.Select(l => l.ProductId).ToList();
        return await levels.QueryNoTracking().Where(l => l.WarehouseId == doc.WarehouseId && ids.Contains(l.ProductId))
            .ToDictionaryAsync(l => l.ProductId, l => l.StockValue, ct);
    }

    private async Task ActAsync(Guid id, string? clientRequestId, InventoryActor actor, Func<Stocktake, CancellationToken, Task> action, CancellationToken ct)
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
            doc.LastRequestId = clientRequestId;
            doc.Version++;
            await unitOfWork.SaveChangesAsync(token);
            return true;
        }, ct);
    }

    private static void EnsureStatus(Stocktake doc, bool allowed)
    {
        if (allowed)
            return;
        if (doc.Status == StocktakeStatus.DaCanBang)
            throw InventoryProblems.AlreadyApproved(doc.Code, doc.ApprovedByName, doc.ApprovedAt);
        throw InventoryErrors.Business(InventoryErrors.TrangThaiKhongHopLe, InventoryErrors.InvalidStatus(InventoryRules.Label(doc.Status)),
            new Dictionary<string, object?> { ["docStatus"] = doc.Status.ToString() });
    }

    private async Task<Stocktake> LoadAsync(Guid id, bool tracking, CancellationToken ct)
    {
        var source = tracking ? stocktakes.Query() : stocktakes.QueryNoTracking();
        return await source.Include(x => x.Lines).Include(x => x.Counts).AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy phiếu kiểm kê.");
    }

    private sealed record DtoContext(
        Dictionary<Guid, Warehouse> Warehouses,
        Dictionary<Guid, string> GroupNames,
        Dictionary<Guid, Product> Products);

    private async Task<DtoContext> LoadContextAsync(IReadOnlyCollection<Stocktake> docs, bool withUnits, CancellationToken ct)
    {
        var groupNames = await groups.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(g => g.Id, g => g.Name, ct);
        var productMap = new Dictionary<Guid, Product>();
        if (withUnits)
        {
            var ids = docs.SelectMany(d => d.Lines.Select(l => l.ProductId)).Distinct().ToList();
            productMap = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Units)
                .Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        }

        return new DtoContext(await DocumentSupport.WarehousesAsync(warehouses, ct), groupNames, productMap);
    }

    private static StocktakeDto ToDto(Stocktake x, InventoryActor actor, DtoContext context, bool withLines)
    {
        var blind = x.Status == StocktakeStatus.DangKiem && !actor.Can(ProjectPermissions.Stocktakes.Approve);
        var canView = actor.CanViewValues;
        var warehouse = context.Warehouses.GetValueOrDefault(x.WarehouseId);
        var scopeGroups = StockQueries.ParseGroupIds(x.ScopeGroupIds)
            .Select(g => new GroupRef(g, context.GroupNames.GetValueOrDefault(g) ?? string.Empty)).ToList();
        return new StocktakeDto
        {
            Id = x.Id,
            Code = x.Code,
            WarehouseId = x.WarehouseId,
            WarehouseCode = warehouse?.Code ?? string.Empty,
            WarehouseName = warehouse?.Name ?? string.Empty,
            ScopeAll = x.ScopeAll,
            Groups = scopeGroups,
            Status = x.Status,
            Version = x.Version,
            SnapshotAt = x.SnapshotAt,
            CreatedById = x.CreatedBy ?? Guid.Empty,
            CreatedByName = x.CreatedByName,
            CounterId = x.CounterId,
            CounterName = x.CounterName,
            SubmittedByName = x.SubmittedByName,
            SubmittedAt = x.SubmittedAt,
            ApprovedById = x.ApprovedById,
            ApprovedByName = x.ApprovedByName,
            ApprovedAt = x.ApprovedAt,
            CancelledByName = x.CancelledByName,
            CancelledAt = x.CancelledAt,
            Note = x.Note,
            ReturnNote = x.ReturnNote,
            TotalLines = x.Lines.Count,
            CountedLines = x.Lines.Count(l => l.CountedQuantity is not null),
            SurplusValue = canView && !blind ? x.SurplusValue : null,
            ShortageValue = canView && !blind ? x.ShortageValue : null,
            IsBlind = blind,
            CanViewValues = canView,
            Lines = withLines
                ? x.Lines.OrderBy(l => l.SortOrder).Select(l =>
                {
                    var product = context.Products.GetValueOrDefault(l.ProductId);
                    return new StocktakeLineDto
                    {
                        Id = l.Id,
                        ProductId = l.ProductId,
                        ProductCode = l.ProductCode,
                        ProductName = l.ProductName,
                        GroupId = l.GroupId,
                        GroupName = l.GroupName,
                        BaseUnit = l.BaseUnit,
                        Units = product?.Units.OrderBy(u => u.SortOrder).Select(u => new CatalogUnit(u.Id, u.Name, u.Factor, u.Barcode)).ToList() ?? [],
                        Barcode = product?.Barcode,
                        BookQuantity = blind ? null : l.BookQuantity,
                        BookCost = blind || !canView ? null : l.BookCost,
                        CountedQuantity = l.CountedQuantity,
                        Difference = blind ? null : l.Difference,
                        DifferencePercent = blind ? null : StockMath.DifferencePercent(l.BookQuantity, l.Difference),
                        DifferenceValue = blind || !canView ? null : l.DifferenceValue,
                        ReasonRequired = blind ? null : l.ReasonRequired,
                        Reason = l.Reason,
                        ReasonNote = l.ReasonNote,
                        NeedsRecount = l.NeedsRecount,
                        RecountNote = l.RecountNote,
                        IsAdded = l.IsAdded,
                        LastCountedByName = l.LastCountedByName,
                        LastCountedAt = l.LastCountedAt
                    };
                }).ToList()
                : []
        };
    }
}
