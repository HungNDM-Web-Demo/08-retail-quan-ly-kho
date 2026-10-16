using Application.Common.Exceptions;
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
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Enums.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Tồn kho, giữ chỗ, cảnh báo, thẻ kho (UC-08, UC-09, UC-10; BR-03, BR-18…BR-20; 07 §2.8, §3.9, §3.10).</summary>
public sealed class StockService(
    IGenericRepository<StockLevel> levels,
    IGenericRepository<StockLedgerEntry> ledger,
    IGenericRepository<Product> products,
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<Transfer> transfers,
    IWarehouseScope scope,
    IStockQueries stockQueries) : IStockService
{
    public async Task<StockListResult> GetLevelsAsync(StockQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var scoped = await scope.GetWarehousesAsync(ct);
        var warehouseId = query.WarehouseId is { } wid && actor.InScope(wid) ? wid : (Guid?)null;
        var warehouseIds = warehouseId is { } single ? [single] : scoped.Select(w => w.Id).ToList();

        var productQuery = products.QueryNoTracking().Include(p => p.Units).Include(p => p.Group).AsQueryable();
        if (query.GroupId is { } groupId)
            productQuery = productQuery.Where(p => p.GroupId == groupId);
        var productMap = await productQuery.AsSplitQuery().ToDictionaryAsync(p => p.Id, ct);
        if (query.GetSearchTerm() is { } term)
        {
            var normalized = TextSearch.Normalize(term);
            productMap = productMap.Values.Where(p => p.SearchText.Contains(normalized, StringComparison.Ordinal)).ToDictionary(p => p.Id);
        }

        var rows = await levels.QueryNoTracking().Where(l => warehouseIds.Contains(l.WarehouseId)).ToListAsync(ct);
        rows = rows.Where(l => productMap.ContainsKey(l.ProductId)).ToList();
        var reserved = await stockQueries.ReservedAllAsync(ct);
        var codes = scoped.ToDictionary(w => w.Id, w => w.Code);
        var canView = actor.CanViewValues;

        List<(StockRowDto Row, Product Product, decimal Value)> items;
        if (warehouseId is { } one)
        {
            items = rows.Select(l =>
            {
                var p = productMap[l.ProductId];
                var r = reserved.GetValueOrDefault((one, p.Id));
                var available = l.OnHand - r;
                var row = BaseRow(p, l.OnHand, r);
                return (new StockRowDto
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    GroupId = p.GroupId,
                    GroupName = p.Group?.Name ?? string.Empty,
                    GroupColor = p.Group?.Color ?? string.Empty,
                    BaseUnit = p.BaseUnit,
                    Units = Readings(p),
                    ImageUrl = p.ImageUrl,
                    WarehouseId = one,
                    OnHand = l.OnHand,
                    Reserved = r,
                    Available = available,
                    Reading = row,
                    AvgCost = canView ? l.AvgCost : null,
                    StockValue = canView ? l.StockValue : null,
                    MinQty = l.MinQty,
                    MaxQty = l.MaxQty,
                    Status = StockMath.Status(l.OnHand, available, l.MinQty, l.MaxQty)
                }, p, l.StockValue);
            }).ToList();
            if (query.Status is { } status)
                items = items.Where(x => x.Row.Status == status).ToList();
        }
        else
        {
            items = rows.GroupBy(l => l.ProductId).Select(g =>
            {
                var p = productMap[g.Key];
                var by = g.OrderBy(l => warehouseIds.IndexOf(l.WarehouseId)).Select(l =>
                {
                    var r = reserved.GetValueOrDefault((l.WarehouseId, p.Id));
                    return new StockByWarehouse(l.WarehouseId, codes.GetValueOrDefault(l.WarehouseId) ?? string.Empty, l.OnHand,
                        l.OnHand - r, StockMath.Status(l.OnHand, l.OnHand - r, l.MinQty, l.MaxQty));
                }).ToList();
                var onHand = g.Sum(l => l.OnHand);
                var res = g.Sum(l => reserved.GetValueOrDefault((l.WarehouseId, p.Id)));
                var value = g.Sum(l => l.StockValue);
                return (new StockRowDto
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    GroupId = p.GroupId,
                    GroupName = p.Group?.Name ?? string.Empty,
                    GroupColor = p.Group?.Color ?? string.Empty,
                    BaseUnit = p.BaseUnit,
                    Units = Readings(p),
                    ImageUrl = p.ImageUrl,
                    OnHand = onHand,
                    Reserved = res,
                    Available = onHand - res,
                    Reading = BaseRow(p, onHand, res),
                    StockValue = canView ? value : null,
                    ByWarehouse = by
                }, p, value);
            }).ToList();
            if (query.Status is { } status)
                items = items.Where(x => x.Row.ByWarehouse!.Any(b => b.Status == status)).ToList();
        }

        if (query.InStockOnly == true)
            items = items.Where(x => x.Row.OnHand > 0).ToList();

        var desc = query.IsDescending() && !string.IsNullOrWhiteSpace(query.SortBy);
        IEnumerable<(StockRowDto Row, Product Product, decimal Value)> sorted = (query.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "productname" => items.OrderBy(x => x.Row.ProductName, StringComparer.CurrentCulture),
            "onhand" => items.OrderBy(x => x.Row.OnHand),
            "available" => items.OrderBy(x => x.Row.Available),
            "reserved" => items.OrderBy(x => x.Row.Reserved),
            "stockvalue" or "avgcost" when canView => items.OrderBy(x => x.Value),
            "groupname" => items.OrderBy(x => x.Row.GroupName),
            _ => items.OrderBy(x => x.Row.ProductCode, StringComparer.Ordinal)
        };
        if (desc)
            sorted = sorted.Reverse();
        var list = sorted.ToList();
        var page = query.GetPage();
        var size = query.GetPageSize();
        return new StockListResult
        {
            Items = list.Skip((page - 1) * size).Take(size).Select(x => x.Row).ToList(),
            Page = page,
            PageSize = size,
            TotalCount = list.Count,
            TotalValue = canView ? list.Sum(x => x.Value) : null,
            CanViewValues = canView
        };
    }

    public async Task<IReadOnlyList<AvailabilityRow>> GetAvailabilityAsync(Guid warehouseId, CancellationToken ct = default)
    {
        await EnsureScopeAsync(warehouseId, ct);
        var rows = await levels.QueryNoTracking().Where(l => l.WarehouseId == warehouseId).ToListAsync(ct);
        var reserved = await stockQueries.ReservedAsync(warehouseId, null, ct);
        return rows.Select(l =>
        {
            var r = reserved.GetValueOrDefault(l.ProductId);
            return new AvailabilityRow(l.ProductId, l.OnHand, r, l.OnHand - r);
        }).ToList();
    }

    public async Task<IReadOnlyList<ReservationDto>> GetReservationsAsync(ReservationQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var codes = (await DocumentSupport.WarehousesAsync(warehouses, ct)).ToDictionary(x => x.Key, x => x.Value.Code);
        var issueRows = await issues.QueryNoTracking()
            .Where(d => d.Status == DocStatus.ChoDuyet && (query.WarehouseId == null || d.WarehouseId == query.WarehouseId))
            .SelectMany(d => d.Lines, (d, l) => new { d.Id, d.Code, d.WarehouseId, d.CreatedByName, d.SubmittedAt, l.ProductId, l.BaseQuantity })
            .Where(x => query.ProductId == null || x.ProductId == query.ProductId)
            .ToListAsync(ct);
        var transferRows = await transfers.QueryNoTracking()
            .Where(d => d.Status == TransferStatus.ChoDuyet && (query.WarehouseId == null || d.FromWarehouseId == query.WarehouseId))
            .SelectMany(d => d.Lines, (d, l) => new { d.Id, d.Code, d.FromWarehouseId, d.ToWarehouseId, d.CreatedByName, d.SubmittedAt, l.ProductId, l.BaseQuantity })
            .Where(x => query.ProductId == null || x.ProductId == query.ProductId)
            .ToListAsync(ct);

        var result = issueRows.Where(x => actor.InScope(x.WarehouseId)).GroupBy(x => x.Id).Select(g => new ReservationDto(
            DocKind.GoodsIssue, g.Key, g.First().Code, codes.GetValueOrDefault(g.First().WarehouseId) ?? string.Empty, null,
            g.First().CreatedByName, g.First().SubmittedAt ?? default, g.Sum(x => x.BaseQuantity)))
            .Concat(transferRows.Where(x => actor.InScope(x.FromWarehouseId)).GroupBy(x => x.Id).Select(g => new ReservationDto(
                DocKind.Transfer, g.Key, g.First().Code, codes.GetValueOrDefault(g.First().FromWarehouseId) ?? string.Empty,
                codes.GetValueOrDefault(g.First().ToWarehouseId), g.First().CreatedByName, g.First().SubmittedAt ?? default,
                g.Sum(x => x.BaseQuantity))))
            .OrderBy(r => r.SubmittedAt)
            .ToList();
        return result;
    }

    public async Task<IReadOnlyList<StockAlertDto>> GetAlertsAsync(StockAlertQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var scoped = await scope.GetWarehousesAsync(ct);
        var scopedIds = scoped.Select(w => w.Id).ToList();
        var targetIds = query.WarehouseId is { } wid && actor.InScope(wid) ? [wid] : scopedIds;
        var productMap = await products.QueryNoTracking().Include(p => p.Units).Include(p => p.Group).AsSplitQuery().ToDictionaryAsync(p => p.Id, ct);
        var all = await levels.QueryNoTracking().Where(l => scopedIds.Contains(l.WarehouseId)).ToListAsync(ct);
        var reserved = await stockQueries.ReservedAllAsync(ct);
        int Available(StockLevel l) => l.OnHand - reserved.GetValueOrDefault((l.WarehouseId, l.ProductId));

        var result = new List<StockAlertDto>();
        foreach (var level in all.Where(l => targetIds.Contains(l.WarehouseId) && productMap.ContainsKey(l.ProductId)))
        {
            var product = productMap[level.ProductId];
            if (query.GroupId is { } groupId && product.GroupId != groupId)
                continue;
            var available = Available(level);
            var status = StockMath.Status(level.OnHand, available, level.MinQty, level.MaxQty);
            if (!StockMath.IsAlert(status, level.MinQty, level.MaxQty) || (query.Status is { } wanted && wanted != status))
                continue;

            var shortage = status is StockStatus.HetHang or StockStatus.DuoiToiThieu;
            var largest = product.Units.Select(u => u.Factor).DefaultIfEmpty(1).Max();
            var suggested = shortage ? StockMath.SuggestQuantity(level.MaxQty, available, largest) : null;
            var warehouse = scoped.First(w => w.Id == level.WarehouseId);
            result.Add(new StockAlertDto
            {
                ProductId = product.Id,
                ProductCode = product.Code,
                ProductName = product.Name,
                GroupName = product.Group?.Name ?? string.Empty,
                BaseUnit = product.BaseUnit,
                Units = Readings(product),
                WarehouseId = warehouse.Id,
                WarehouseCode = warehouse.Code,
                OnHand = level.OnHand,
                Available = available,
                MinQty = level.MinQty,
                MaxQty = level.MaxQty,
                Status = status,
                SuggestedQuantity = suggested,
                SuggestedReading = suggested is { } s ? StockMath.ReadQuantity(s, product.BaseUnit, product.Units.Select(u => (u.Name, u.Factor))) : null,
                Sources = shortage
                    ? all.Where(l => l.ProductId == product.Id && l.WarehouseId != warehouse.Id && Available(l) > 0)
                        .Select(l => (Level: l, Warehouse: scoped.First(w => w.Id == l.WarehouseId)))
                        .Where(x => x.Warehouse.IsActive)
                        .OrderBy(x => scopedIds.IndexOf(x.Warehouse.Id))
                        .Select(x => new AlertSource(x.Warehouse.Id, x.Warehouse.Code, x.Warehouse.Name, Available(x.Level)))
                        .ToList()
                    : []
            });
        }

        int Rank(StockStatus s) => s switch { StockStatus.HetHang => 0, StockStatus.DuoiToiThieu => 1, _ => 2 };
        return result.OrderBy(a => Rank(a.Status)).ThenBy(a => a.ProductCode, StringComparer.Ordinal)
            .ThenBy(a => scopedIds.IndexOf(a.WarehouseId)).ToList();
    }

    public async Task<StockCardDto> GetStockCardAsync(StockCardQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var range = DocumentSupport.ParseRange(query.From, query.To, required: true)!.Value;
        var product = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Units).FirstOrDefaultAsync(p => p.Id == query.ProductId, ct)
            ?? throw new NotFoundException("Không tìm thấy mặt hàng.");
        var scoped = await scope.GetWarehousesAsync(ct);
        var single = query.WarehouseId is { } wid && actor.InScope(wid) ? scoped.FirstOrDefault(w => w.Id == wid) : null;
        var warehouseIds = single is not null ? [single.Id] : scoped.Select(w => w.Id).ToList();
        var codes = scoped.ToDictionary(w => w.Id, w => w.Code);

        var entries = await ledger.QueryNoTracking()
            .Where(e => e.ProductId == product.Id && warehouseIds.Contains(e.WarehouseId) && e.PostedAt < range.ToUtcExclusive)
            .ToListAsync(ct);
        var ordered = entries.OrderBy(e => e.PostedAt).ThenBy(e => e.DocCode, StringComparer.Ordinal).ThenBy(e => e.Seq).ToList();
        var before = ordered.Where(e => e.PostedAt < range.FromUtc).ToList();
        var openingQty = before.GroupBy(e => e.WarehouseId).Sum(g => g.Last().BalanceQuantity);
        var openingValue = before.GroupBy(e => e.WarehouseId).Sum(g => g.Last().BalanceValue);
        var inPeriod = ordered.Where(e => e.PostedAt >= range.FromUtc).ToList();

        var canView = actor.CanViewValues;
        var runningQty = openingQty;
        var runningValue = openingValue;
        var lines = new List<StockCardLineDto>();
        foreach (var e in inPeriod)
        {
            runningQty += e.InQuantity - e.OutQuantity;
            runningValue += e.InValue - e.OutValue;
            lines.Add(new StockCardLineDto
            {
                Id = e.Id,
                PostedAt = e.PostedAt,
                WarehouseId = e.WarehouseId,
                WarehouseCode = codes.GetValueOrDefault(e.WarehouseId) ?? string.Empty,
                DocType = e.DocType,
                DocKind = KindOf(e.DocType),
                DocId = e.DocId,
                DocCode = e.DocCode,
                Description = e.Description,
                InQuantity = e.InQuantity,
                OutQuantity = e.OutQuantity,
                BalanceQuantity = single is not null ? e.BalanceQuantity : runningQty,
                UnitCost = canView ? e.UnitCost : null,
                InValue = canView ? e.InValue : null,
                OutValue = canView ? e.OutValue : null,
                BalanceValue = canView ? (single is not null ? e.BalanceValue : runningValue) : null,
                AvgCostAfter = canView && single is not null ? e.AvgCostAfter : null
            });
        }

        var totalIn = inPeriod.Sum(e => e.InQuantity);
        var totalOut = inPeriod.Sum(e => e.OutQuantity);
        var inValue = inPeriod.Sum(e => e.InValue);
        var outValue = inPeriod.Sum(e => e.OutValue);
        return new StockCardDto
        {
            Product = new StockCardProduct(product.Id, product.Code, product.Name, product.BaseUnit, Readings(product)),
            WarehouseId = single?.Id,
            WarehouseCode = single?.Code,
            From = VietnamDates.Format(range.From),
            To = VietnamDates.Format(range.To),
            Opening = new QuantityValue(openingQty, canView ? openingValue : null),
            Totals = new StockCardTotals(totalIn, totalOut, canView ? inValue : null, canView ? outValue : null),
            Closing = new QuantityValue(openingQty + totalIn - totalOut, canView ? openingValue + inValue - outValue : null),
            Lines = lines,
            CanViewValues = canView
        };
    }

    public static DocKind KindOf(LedgerDocType type) => type switch
    {
        LedgerDocType.PhieuNhap => DocKind.GoodsReceipt,
        LedgerDocType.PhieuXuat => DocKind.GoodsIssue,
        LedgerDocType.KiemKe => DocKind.Stocktake,
        _ => DocKind.Transfer
    };

    internal static IReadOnlyList<UnitReading> Readings(Product p) =>
        p.Units.OrderBy(u => u.SortOrder).Select(u => new UnitReading(u.Name, u.Factor)).ToList();

    private static string BaseRow(Product p, int onHand, int _) =>
        StockMath.ReadQuantity(onHand, p.BaseUnit, p.Units.Select(u => (u.Name, u.Factor)));

    private async Task EnsureScopeAsync(Guid warehouseId, CancellationToken ct)
    {
        var actor = await scope.GetActorAsync(ct);
        if (!actor.InScope(warehouseId))
        {
            var code = await warehouses.QueryNoTracking().Where(w => w.Id == warehouseId).Select(w => w.Code).FirstOrDefaultAsync(ct);
            throw InventoryProblems.NotKeeper(code ?? string.Empty);
        }
    }
}
