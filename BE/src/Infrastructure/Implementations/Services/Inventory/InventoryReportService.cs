using Application.Common.Time;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Entities.System.Settings;
using Domain.Enums.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Tổng quan, Việc cần làm, báo cáo (UC-12…UC-14; FR-01…FR-03, FR-32…FR-35; 07 §2.10, §3.10, §3.11).</summary>
public sealed class InventoryReportService(
    IGenericRepository<StockLevel> levels,
    IGenericRepository<StockLedgerEntry> ledger,
    IGenericRepository<Product> products,
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<Supplier> suppliers,
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<Transfer> transfers,
    IGenericRepository<Stocktake> stocktakes,
    IGenericRepository<Setting> settings,
    IWarehouseScope scope,
    IStockQueries stockQueries,
    TimeProvider timeProvider) : IInventoryReportService
{
    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<DashboardReport> GetDashboardAsync(CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var scoped = (await scope.GetWarehousesAsync(ct)).Where(w => w.IsActive).ToList();
        var ids = scoped.Select(w => w.Id).ToList();
        var levelRows = await levels.QueryNoTracking().Where(l => ids.Contains(l.WarehouseId)).ToListAsync(ct);
        var reserved = await stockQueries.ReservedAllAsync(ct);

        int below = 0, outOfStock = 0, overMax = 0;
        foreach (var l in levelRows)
        {
            var status = StockMath.Status(l.OnHand, l.OnHand - reserved.GetValueOrDefault((l.WarehouseId, l.ProductId)), l.MinQty, l.MaxQty);
            if (!StockMath.IsAlert(status, l.MinQty, l.MaxQty))
                continue;
            if (status == StockStatus.HetHang) outOfStock++;
            else if (status == StockStatus.DuoiToiThieu) below++;
            else if (status == StockStatus.VuotToiDa) overMax++;
        }

        var pendingReceipts = await receipts.QueryNoTracking().CountAsync(x => x.Status == DocStatus.ChoDuyet && ids.Contains(x.WarehouseId), ct);
        var pendingIssues = await issues.QueryNoTracking().CountAsync(x => x.Status == DocStatus.ChoDuyet && ids.Contains(x.WarehouseId), ct);
        var pendingTransfers = await transfers.QueryNoTracking().CountAsync(x => x.Status == TransferStatus.ChoDuyet && ids.Contains(x.FromWarehouseId), ct);
        var pendingStocktakes = await stocktakes.QueryNoTracking().CountAsync(x => x.Status == StocktakeStatus.ChoDuyet && ids.Contains(x.WarehouseId), ct);

        var inTransit = await transfers.QueryNoTracking()
            .Where(x => x.Status == TransferStatus.DangChuyen && (ids.Contains(x.FromWarehouseId) || ids.Contains(x.ToWarehouseId)))
            .Select(x => new { x.TotalValue, x.ApprovedAt }).ToListAsync(ct);
        var now = Now;

        var today = VietnamDates.Today(timeProvider);
        var firstDay = today.AddDays(-29);
        var fromUtc = VietnamDates.StartOfDayUtc(firstDay);
        var receiptDays = await receipts.QueryNoTracking()
            .Where(x => x.Status == DocStatus.DaDuyet && x.ApprovedAt >= fromUtc && ids.Contains(x.WarehouseId))
            .Select(x => new { x.ApprovedAt, x.TotalValue }).ToListAsync(ct);
        var issueDocs = await issues.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.Status == DocStatus.DaDuyet && x.Type != IssueType.XuatDieuChinh && x.ApprovedAt >= fromUtc && ids.Contains(x.WarehouseId))
            .ToListAsync(ct);
        var daily = Enumerable.Range(0, 30).Select(i =>
        {
            var day = firstDay.AddDays(i);
            return new DailyMovement(
                VietnamDates.Format(day),
                receiptDays.Where(r => VietnamDates.DateOf(r.ApprovedAt!.Value) == day).Sum(r => r.TotalValue),
                issueDocs.Where(r => VietnamDates.DateOf(r.ApprovedAt!.Value) == day).Sum(r => r.TotalValue ?? 0));
        }).ToList();

        var productMap = await products.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(p => p.Id, ct);
        var top = issueDocs.SelectMany(d => d.Lines)
            .GroupBy(l => l.ProductId)
            .Select(g => new TopIssued(g.Key, productMap[g.Key].Code, productMap[g.Key].Name, productMap[g.Key].BaseUnit,
                g.Sum(l => l.BaseQuantity), g.Sum(l => l.Value ?? 0)))
            .OrderByDescending(t => t.Value).ThenBy(t => t.Code, StringComparer.Ordinal)
            .Take(10)
            .ToList();

        var dashboardWarehouses = scoped.Select(w => new DashboardWarehouse(w.Id, w.Code, w.Name,
            levelRows.Where(l => l.WarehouseId == w.Id).Sum(l => l.StockValue),
            levelRows.Count(l => l.WarehouseId == w.Id && l.OnHand > 0))).ToList();
        return new DashboardReport
        {
            AsOf = now,
            Warehouses = dashboardWarehouses,
            TotalStockValue = dashboardWarehouses.Sum(w => w.StockValue),
            BelowMinCount = below,
            OutOfStockCount = outOfStock,
            OverMaxCount = overMax,
            Pending = new PendingCounts(pendingReceipts, pendingIssues, pendingTransfers, pendingStocktakes,
                pendingReceipts + pendingIssues + pendingTransfers + pendingStocktakes),
            InTransit = new InTransitSummary(inTransit.Count, inTransit.Sum(t => t.TotalValue ?? 0),
                inTransit.Count(t => t.ApprovedAt is { } at && StockMath.IsLate(at, now))),
            Daily = daily,
            TopIssued = actor.CanViewValues ? top : []
        };
    }

    public async Task<StaffTodo> GetStaffTodoAsync(CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var scoped = await scope.GetWarehousesAsync(ct);
        var ids = scoped.Select(w => w.Id).ToList();
        // Mã kho tra trên mọi kho: phiếu chuyển tới kho không phụ trách vẫn ghi đủ "KTONG → KBH" (07 §5 #46)
        var allCodes = (await DocumentSupport.WarehousesAsync(warehouses, ct)).ToDictionary(x => x.Key, x => x.Value.Code);
        string Code(Guid id) => allCodes.GetValueOrDefault(id) ?? string.Empty;
        var me = actor.UserId;
        var open = new[] { DocStatus.Nhap, DocStatus.TuChoi, DocStatus.ChoDuyet };
        var openTransfer = new[] { TransferStatus.Nhap, TransferStatus.TuChoi, TransferStatus.ChoDuyet };

        var myReceipts = await receipts.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.CreatedBy == me && open.Contains(x.Status) && ids.Contains(x.WarehouseId)).ToListAsync(ct);
        var myIssues = await issues.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.CreatedBy == me && open.Contains(x.Status) && ids.Contains(x.WarehouseId)).ToListAsync(ct);
        var myTransfers = await transfers.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.CreatedBy == me && openTransfer.Contains(x.Status) && ids.Contains(x.FromWarehouseId)).ToListAsync(ct);

        var docs = myReceipts.Select(d => (Doc: (Domain.Entities.Inventory.Documents.InventoryDocument)d, Kind: DocKind.GoodsReceipt,
                Wh: d.WarehouseId, To: (Guid?)null, Text: $"Phiếu nhập · {InventoryRules.Label(d.Type)}", Lines: d.Lines.Count,
                Draft: d.Status == DocStatus.Nhap, Rejected: d.Status == DocStatus.TuChoi))
            .Concat(myIssues.Select(d => (Doc: (Domain.Entities.Inventory.Documents.InventoryDocument)d, Kind: DocKind.GoodsIssue,
                Wh: d.WarehouseId, To: (Guid?)null, Text: $"Phiếu xuất · {InventoryRules.Label(d.Type)}", Lines: d.Lines.Count,
                Draft: d.Status == DocStatus.Nhap, Rejected: d.Status == DocStatus.TuChoi)))
            .Concat(myTransfers.Select(d => (Doc: (Domain.Entities.Inventory.Documents.InventoryDocument)d, Kind: DocKind.Transfer,
                Wh: d.FromWarehouseId, To: (Guid?)d.ToWarehouseId, Text: $"Chuyển kho {Code(d.FromWarehouseId)} → {Code(d.ToWarehouseId)}",
                Lines: d.Lines.Count, Draft: d.Status == TransferStatus.Nhap, Rejected: d.Status == TransferStatus.TuChoi)))
            .OrderByDescending(x => x.Doc.UpdatedAt ?? x.Doc.CreatedAt)
            .ToList();

        TodoDoc Todo((Domain.Entities.Inventory.Documents.InventoryDocument Doc, DocKind Kind, Guid Wh, Guid? To, string Text, int Lines, bool Draft, bool Rejected) x) => new()
        {
            Kind = x.Kind,
            Id = x.Doc.Id,
            Code = x.Doc.Code,
            WarehouseCode = Code(x.Wh),
            ToWarehouseCode = x.To is { } to ? Code(to) : null,
            TypeText = x.Text,
            CreatedAt = x.Doc.CreatedAt,
            UpdatedAt = x.Doc.UpdatedAt ?? x.Doc.CreatedAt,
            LineCount = x.Lines
        };

        var toReceive = await transfers.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.Status == TransferStatus.DangChuyen && ids.Contains(x.ToWarehouseId))
            .OrderBy(x => x.ApprovedAt).ToListAsync(ct);
        var counting = await stocktakes.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.Status == StocktakeStatus.DangKiem && ids.Contains(x.WarehouseId))
            .OrderBy(x => x.CreatedAt).ToListAsync(ct);
        var now = Now;

        return new StaffTodo
        {
            Warehouses = scoped,
            Drafts = docs.Where(x => x.Draft).Select(Todo).ToList(),
            Rejected = docs.Where(x => x.Rejected).Select(x =>
            {
                var t = Todo(x);
                return new RejectedTodoDoc
                {
                    Kind = t.Kind, Id = t.Id, Code = t.Code, WarehouseCode = t.WarehouseCode, ToWarehouseCode = t.ToWarehouseCode,
                    TypeText = t.TypeText, CreatedAt = t.CreatedAt, UpdatedAt = t.UpdatedAt, LineCount = t.LineCount,
                    RejectReason = x.Doc.RejectReason ?? string.Empty,
                    RejectedByName = x.Doc.RejectedByName ?? string.Empty,
                    RejectedAt = x.Doc.RejectedAt ?? x.Doc.CreatedAt
                };
            }).ToList(),
            Waiting = docs.Where(x => !x.Draft && !x.Rejected).Select(Todo).ToList(),
            ToReceive = toReceive.Select(d => new ReceiveTodoDoc
            {
                Kind = DocKind.Transfer,
                Id = d.Id,
                Code = d.Code,
                WarehouseCode = allCodes.GetValueOrDefault(d.ToWarehouseId) ?? string.Empty,
                ToWarehouseCode = allCodes.GetValueOrDefault(d.ToWarehouseId),
                FromWarehouseCode = allCodes.GetValueOrDefault(d.FromWarehouseId) ?? string.Empty,
                TypeText = $"Chuyển kho {allCodes.GetValueOrDefault(d.FromWarehouseId)} → {allCodes.GetValueOrDefault(d.ToWarehouseId)}",
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt ?? d.CreatedAt,
                LineCount = d.Lines.Count,
                ApprovedAt = d.ApprovedAt ?? d.CreatedAt,
                IsLate = d.ApprovedAt is { } at && StockMath.IsLate(at, now)
            }).ToList(),
            Counting = counting.Select(d => new CountingTodoDoc
            {
                Kind = DocKind.Stocktake,
                Id = d.Id,
                Code = d.Code,
                WarehouseCode = Code(d.WarehouseId),
                TypeText = d.ScopeAll ? "Kiểm kê · Toàn kho" : "Kiểm kê · Theo nhóm hàng",
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt ?? d.CreatedAt,
                LineCount = d.Lines.Count,
                CounterName = d.CounterName,
                CountedLines = d.Lines.Count(l => l.CountedQuantity != null),
                TotalLines = d.Lines.Count
            }).ToList()
        };
    }

    public async Task<MovementReport> GetMovementAsync(MovementQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var range = DocumentSupport.ParseRange(query.From, query.To, required: true)!.Value;
        var scoped = await scope.GetWarehousesAsync(ct);
        var single = query.WarehouseId is { } wid && actor.InScope(wid) ? wid : (Guid?)null;
        var ids = single is { } one ? [one] : scoped.Select(w => w.Id).ToList();

        var productMap = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Group).ToDictionaryAsync(p => p.Id, ct);
        var entries = await ledger.QueryNoTracking()
            .Where(e => ids.Contains(e.WarehouseId) && e.PostedAt < range.ToUtcExclusive)
            .ToListAsync(ct);
        if (query.GroupId is { } groupId)
            entries = entries.Where(e => productMap[e.ProductId].GroupId == groupId).ToList();

        var rows = new List<MovementRow>();
        foreach (var byProduct in entries.GroupBy(e => e.ProductId))
        {
            var p = productMap[byProduct.Key];
            var row = new MovementRow
            {
                ProductId = p.Id,
                ProductCode = p.Code,
                ProductName = p.Name,
                GroupId = p.GroupId,
                GroupName = p.Group?.Name ?? string.Empty,
                BaseUnit = p.BaseUnit
            };
            foreach (var byWarehouse in byProduct.GroupBy(e => e.WarehouseId))
            {
                var ordered = byWarehouse.OrderBy(e => e.PostedAt).ThenBy(e => e.DocCode, StringComparer.Ordinal).ThenBy(e => e.Seq).ToList();
                var last = ordered.LastOrDefault(e => e.PostedAt < range.FromUtc);
                row.OpeningQty += last?.BalanceQuantity ?? 0;
                row.OpeningValue += last?.BalanceValue ?? 0;
                foreach (var e in ordered.Where(e => e.PostedAt >= range.FromUtc))
                {
                    row.InQty += e.InQuantity;
                    row.InValue += e.InValue;
                    row.OutQty += e.OutQuantity;
                    row.OutValue += e.OutValue;
                }
            }

            row.ClosingQty = row.OpeningQty + row.InQty - row.OutQty;
            row.ClosingValue = row.OpeningValue + row.InValue - row.OutValue;
            if (row.OpeningQty != 0 || row.InQty != 0 || row.OutQty != 0 || row.ClosingQty != 0 || row.OpeningValue != 0 || row.ClosingValue != 0)
                rows.Add(row);
        }

        rows = rows.OrderBy(r => productMap[r.ProductId].Group?.SortOrder ?? 0).ThenBy(r => r.ProductCode, StringComparer.Ordinal).ToList();

        InTransitBlock? inTransit = null;
        if (single is null)
        {
            var scopeIds = ids;
            var moving = await transfers.QueryNoTracking().Include(t => t.Lines)
                .Where(t => t.ApprovedAt != null && t.ApprovedAt < range.ToUtcExclusive
                    && (t.ReceivedAt == null || t.ReceivedAt >= range.ToUtcExclusive)
                    && (t.Status == TransferStatus.DangChuyen || t.Status == TransferStatus.DaNhan)
                    && (scopeIds.Contains(t.FromWarehouseId) || scopeIds.Contains(t.ToWarehouseId)))
                .ToListAsync(ct);
            var lines = moving.SelectMany(t => t.Lines)
                .Where(l => query.GroupId is not { } g || productMap[l.ProductId].GroupId == g)
                .GroupBy(l => l.ProductId)
                .Select(g => new InTransitLine(g.Key, productMap[g.Key].Code, productMap[g.Key].Name, productMap[g.Key].BaseUnit,
                    g.Sum(l => l.BaseQuantity), g.Sum(l => l.Value ?? 0)))
                .OrderBy(l => l.ProductCode, StringComparer.Ordinal)
                .ToList();
            inTransit = new InTransitBlock(lines.Sum(l => l.Value), lines);
        }

        return new MovementReport
        {
            From = VietnamDates.Format(range.From),
            To = VietnamDates.Format(range.To),
            WarehouseId = single,
            Rows = rows,
            Totals = new MovementTotals(rows.Sum(r => r.OpeningQty), rows.Sum(r => r.OpeningValue), rows.Sum(r => r.InQty), rows.Sum(r => r.InValue),
                rows.Sum(r => r.OutQty), rows.Sum(r => r.OutValue), rows.Sum(r => r.ClosingQty), rows.Sum(r => r.ClosingValue)),
            InTransit = inTransit
        };
    }

    public async Task<IReadOnlyList<SlowMovingRow>> GetSlowMovingAsync(SlowMovingQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var scoped = await scope.GetWarehousesAsync(ct);
        var ids = query.WarehouseId is { } wid && actor.InScope(wid) ? [wid] : scoped.Select(w => w.Id).ToList();
        var codes = scoped.ToDictionary(w => w.Id, w => w.Code);
        var productMap = await products.QueryNoTracking().IgnoreQueryFilters().Include(p => p.Group).ToDictionaryAsync(p => p.Id, ct);
        var rows = await levels.QueryNoTracking().Where(l => ids.Contains(l.WarehouseId) && l.OnHand > 0).ToListAsync(ct);
        var today = VietnamDates.Today(timeProvider);

        return rows
            .Where(l => query.GroupId is not { } g || productMap[l.ProductId].GroupId == g)
            .Select(l => (Level: l, Ref: l.LastIssueAt ?? l.FirstReceiptAt))
            .Where(x => x.Ref is not null)
            .Select(x => (x.Level, Days: today.DayNumber - VietnamDates.DateOf(x.Ref!.Value).DayNumber))
            .Where(x => StockMath.SlowBucket(x.Days) is not null)
            .OrderByDescending(x => x.Level.StockValue).ThenByDescending(x => x.Days)
            .Select(x =>
            {
                var p = productMap[x.Level.ProductId];
                return new SlowMovingRow
                {
                    ProductId = p.Id,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    GroupName = p.Group?.Name ?? string.Empty,
                    BaseUnit = p.BaseUnit,
                    WarehouseId = x.Level.WarehouseId,
                    WarehouseCode = codes.GetValueOrDefault(x.Level.WarehouseId) ?? string.Empty,
                    OnHand = x.Level.OnHand,
                    StockValue = actor.CanViewValues ? x.Level.StockValue : null,
                    LastIssueAt = x.Level.LastIssueAt,
                    FirstReceiptAt = x.Level.FirstReceiptAt,
                    DaysSince = x.Days,
                    Bucket = StockMath.SlowBucket(x.Days)!.Value
                };
            })
            .ToList();
    }

    public async Task<IReadOnlyList<SupplierReceiptRow>> GetReceiptsBySupplierAsync(ReportPeriodQuery query, CancellationToken ct = default)
    {
        var (from, to, ids) = await PeriodAsync(query, ct);
        var docs = await receipts.QueryNoTracking()
            .Where(x => x.Status == DocStatus.DaDuyet && x.Type == ReceiptType.MuaHang && x.SupplierId != null
                && x.ApprovedAt >= from && x.ApprovedAt < to && ids.Contains(x.WarehouseId))
            .Select(x => new { SupplierId = x.SupplierId!.Value, x.TotalAmount, x.FreightCost, x.TotalValue })
            .ToListAsync(ct);
        var supplierMap = await DocumentSupport.SuppliersAsync(suppliers, ct);
        var total = docs.Sum(d => d.TotalValue);
        return docs.GroupBy(d => d.SupplierId)
            .Select(g => new SupplierReceiptRow(g.Key, supplierMap[g.Key].Code, supplierMap[g.Key].Name, g.Count(),
                g.Sum(d => d.TotalAmount), g.Sum(d => d.FreightCost), g.Sum(d => d.TotalValue), Share(g.Sum(d => d.TotalValue), total)))
            .OrderByDescending(r => r.TotalValue)
            .ToList();
    }

    public async Task<IReadOnlyList<IssueTypeRow>> GetIssuesByTypeAsync(ReportPeriodQuery query, CancellationToken ct = default)
    {
        var (from, to, ids) = await PeriodAsync(query, ct);
        var docs = await issues.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.Status == DocStatus.DaDuyet && x.ApprovedAt >= from && x.ApprovedAt < to && ids.Contains(x.WarehouseId))
            .ToListAsync(ct);
        var total = docs.Sum(d => d.TotalValue ?? 0);
        return Enum.GetValues<IssueType>().Select(type =>
        {
            var ofType = docs.Where(d => d.Type == type).ToList();
            var value = ofType.Sum(d => d.TotalValue ?? 0);
            return new IssueTypeRow(type, ofType.Count, ofType.Sum(d => d.Lines.Sum(l => l.BaseQuantity)), value, Share(value, total));
        }).ToList();
    }

    public async Task<IReadOnlyList<StocktakeVarianceRow>> GetStocktakeVariancesAsync(ReportPeriodQuery query, CancellationToken ct = default)
    {
        var (from, to, ids) = await PeriodAsync(query, ct);
        var codes = (await DocumentSupport.WarehousesAsync(warehouses, ct)).ToDictionary(x => x.Key, x => x.Value.Code);
        var docs = await stocktakes.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.Status == StocktakeStatus.DaCanBang && x.ApprovedAt >= from && x.ApprovedAt < to && ids.Contains(x.WarehouseId))
            .OrderBy(x => x.ApprovedAt)
            .ToListAsync(ct);
        return docs.Select(d =>
        {
            var variance = d.Lines.Where(l => (l.Difference ?? 0) != 0).ToList();
            var surplus = variance.Where(l => l.DifferenceValue > 0).Sum(l => l.DifferenceValue ?? 0);
            var shortage = variance.Where(l => l.DifferenceValue < 0).Sum(l => -(l.DifferenceValue ?? 0));
            return new StocktakeVarianceRow(d.Id, d.Code, codes.GetValueOrDefault(d.WarehouseId) ?? string.Empty, d.ApprovedAt!.Value,
                d.Lines.Count, variance.Count, surplus, shortage, surplus - shortage,
                variance.GroupBy(l => l.Reason).OrderBy(g => g.Key is null ? int.MaxValue : (int)g.Key)
                    .Select(g => new VarianceByReason(g.Key, g.Count(), g.Sum(l => l.DifferenceValue ?? 0))).ToList());
        }).ToList();
    }

    public async Task<IReadOnlyList<TransferLossRow>> GetTransferLossesAsync(TransferLossQuery query, CancellationToken ct = default)
    {
        var range = DocumentSupport.ParseRange(query.From, query.To, required: true)!.Value;
        var scoped = await scope.GetWarehousesAsync(ct);
        var ids = scoped.Select(w => w.Id).ToList();
        var codes = (await DocumentSupport.WarehousesAsync(warehouses, ct)).ToDictionary(x => x.Key, x => x.Value.Code);
        var docs = await transfers.QueryNoTracking().Include(x => x.Lines)
            .Where(x => x.Status == TransferStatus.DaNhan && x.ReceivedAt >= range.FromUtc && x.ReceivedAt < range.ToUtcExclusive
                && (ids.Contains(x.FromWarehouseId) || ids.Contains(x.ToWarehouseId)))
            .ToListAsync(ct);
        if (query.FromWarehouseId is { } fromId)
            docs = docs.Where(d => d.FromWarehouseId == fromId).ToList();
        if (query.ToWarehouseId is { } toId)
            docs = docs.Where(d => d.ToWarehouseId == toId).ToList();

        return docs.GroupBy(d => (d.FromWarehouseId, d.ToWarehouseId))
            .Select(g => new TransferLossRow(
                codes.GetValueOrDefault(g.Key.FromWarehouseId) ?? string.Empty,
                codes.GetValueOrDefault(g.Key.ToWarehouseId) ?? string.Empty,
                g.Count(),
                g.Sum(d => d.Lines.Count(l => (l.ShortageQuantity ?? 0) > 0)),
                g.Sum(d => d.ShortageValue ?? 0),
                g.Where(d => (d.ShortageValue ?? 0) > 0 || d.Lines.Any(l => (l.ShortageQuantity ?? 0) > 0))
                    .OrderBy(d => d.ReceivedAt)
                    .Select(d => new TransferLossItem(d.Id, d.Code ?? string.Empty, d.ReceivedAt!.Value,
                        d.Lines.Sum(l => l.ShortageQuantity ?? 0), d.ShortageValue ?? 0))
                    .ToList()))
            .OrderByDescending(r => r.ShortageValue).ThenBy(r => r.FromWarehouseCode).ThenBy(r => r.ToWarehouseCode)
            .ToList();
    }

    public async Task<StoreProfile> GetStoreProfileAsync(CancellationToken ct = default)
    {
        var keys = new[] { "Store.Name", "Store.Address", "Store.Phone", "Store.TaxCode", "Store.DirectorName", "Store.ChiefAccountantName", "Brand.LogoUrl" };
        var map = await settings.QueryNoTracking().Where(s => keys.Contains(s.Key)).ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        string Get(string key) => map.GetValueOrDefault(key) ?? string.Empty;
        return new StoreProfile(Get("Store.Name"), Get("Store.Address"), Get("Store.Phone"), Get("Store.TaxCode"),
            Get("Store.DirectorName"), Get("Store.ChiefAccountantName"), Get("Brand.LogoUrl"));
    }

    private async Task<(DateTime From, DateTime To, List<Guid> Ids)> PeriodAsync(ReportPeriodQuery query, CancellationToken ct)
    {
        var actor = await scope.GetActorAsync(ct);
        var range = DocumentSupport.ParseRange(query.From, query.To, required: true)!.Value;
        var scoped = await scope.GetWarehousesAsync(ct);
        var ids = query.WarehouseId is { } wid && actor.InScope(wid) ? [wid] : scoped.Select(w => w.Id).ToList();
        return (range.FromUtc, range.ToUtcExclusive, ids);
    }

    private static decimal Share(decimal value, decimal total) =>
        total == 0 ? 0 : Math.Round(value * 100 / total, 1, MidpointRounding.AwayFromZero);
}
