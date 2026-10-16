using System.Text.Json;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.Documents;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Suppliers;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory;
using Infrastructure.Implementations.Services.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu nghiệp vụ mẫu Quản lý Kho từ <c>FE/src/mock/seed/demo-data.json</c> (06 §5). Danh mục nạp thẳng; chứng từ
/// đã ghi sổ được ghi sổ lại theo thời gian bằng chính <see cref="IStockPostingService"/> (06 §5.5) để tồn, giá vốn,
/// thẻ kho ra đúng như khi người dùng duyệt từng phiếu.
/// </summary>
public sealed class DemoDataSeeder(AppDbContext db, IStockPostingService posting, TimeProvider timeProvider) : IDemoDataSeeder
{
    public const string FileName = "demo-data.json";

    public Task<bool> HasDataAsync(CancellationToken ct = default) =>
        db.Set<Warehouse>().IgnoreQueryFilters().AnyAsync(ct);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var seed = SeedJson.Read<InventorySeedFile>(FileName, timeProvider);
        var clock = new SeedClock(timeProvider);
        var users = await db.Set<User>().IgnoreQueryFilters().ToDictionaryAsync(u => u.Username, StringComparer.OrdinalIgnoreCase, ct);
        User UserOf(string username) => users.TryGetValue(username, out var user)
            ? user
            : throw new InvalidOperationException($"Seed tham chiếu tài khoản '{username}' không có trong System_Users.");

        // Danh mục (06 §5.2).
        var groups = seed.ProductGroups.Select((g, i) => new ProductGroup { Code = g.Code, Name = g.Name, Color = g.Color, SortOrder = (i + 1) * 10 })
            .ToDictionary(g => g.Code);
        var warehouses = seed.Warehouses.Select((w, i) => new Warehouse
        {
            Code = w.Code,
            Name = w.Name,
            Address = w.Address,
            Phone = w.Phone,
            IsActive = w.Active ?? true,
            SortOrder = (i + 1) * 10,
            Keepers = (w.Keepers ?? []).Select(k => new WarehouseKeeper { UserId = UserOf(k).Id }).ToList()
        }).ToDictionary(w => w.Code);
        foreach (var w in warehouses.Values)
            w.Keepers.ForEach(k => k.WarehouseId = w.Id);
        var suppliers = seed.Suppliers.Select(s => new Supplier
        {
            Code = s.Code,
            Name = s.Name,
            TaxCode = s.TaxCode,
            Phone = s.Phone,
            Address = s.Address,
            ContactName = s.ContactName,
            IsActive = s.Active ?? true
        }).ToDictionary(s => s.Code);

        var products = new Dictionary<string, Product>();
        var levels = new List<StockLevel>();
        foreach (var p in seed.Products)
        {
            var product = new Product
            {
                Code = p.Code,
                Name = p.Name,
                GroupId = groups[p.Group].Id,
                Group = groups[p.Group],
                BaseUnit = p.Unit,
                Barcode = p.Barcode,
                Spec = p.Spec,
                ImageUrl = p.Image is null ? null : $"/seed/products/{p.Image}.webp"
            };
            product.Units = p.Units.Select((u, i) => new ProductUnit
            {
                ProductId = product.Id,
                Name = u[0].GetString()!,
                Factor = u[1].GetInt32(),
                Barcode = u.Count > 2 && u[2].ValueKind == JsonValueKind.String ? u[2].GetString() : null,
                SortOrder = i + 1
            }).ToList();
            product.RefreshSearchText();
            products[p.Code] = product;
            foreach (var (code, range) in p.Stock)
            {
                levels.Add(new StockLevel
                {
                    WarehouseId = warehouses[code].Id,
                    ProductId = product.Id,
                    MinQty = range.ElementAtOrDefault(0),
                    MaxQty = range.ElementAtOrDefault(1)
                });
            }
        }

        db.AddRange(groups.Values);
        db.AddRange(warehouses.Values);
        db.AddRange(suppliers.Values);
        db.AddRange(products.Values);
        db.AddRange(levels);

        // Chứng từ (06 §5.4).
        var receipts = seed.Receipts.ToDictionary(r => r.Id, r => BuildReceipt(r, warehouses, suppliers, products, clock, UserOf));
        var issues = seed.Issues.ToDictionary(x => x.Id, x => BuildIssue(x, warehouses, suppliers, products, clock, UserOf));
        var transfers = seed.Transfers.ToDictionary(t => t.Id, t => BuildTransfer(t, warehouses, products, clock, UserOf));
        foreach (var r in seed.Receipts.Where(r => r.Rv is not null))
            receipts[r.Id].ReversalOfIssueId = issues[r.Rv!].Id;
        foreach (var x in seed.Issues.Where(x => x.Rv is not null))
            issues[x.Id].ReversalOfReceiptId = receipts[x.Rv!].Id;

        AssignCodes(InventoryRules.ReceiptPrefix, seed.Receipts.Select((r, i) => (r.Sb, i, (InventoryDocument)receipts[r.Id])), clock);
        AssignCodes(InventoryRules.IssuePrefix, seed.Issues.Select((r, i) => (r.Sb, i, (InventoryDocument)issues[r.Id])), clock);
        AssignCodes(InventoryRules.TransferPrefix, seed.Transfers.Select((r, i) => (r.Sb, i, (InventoryDocument)transfers[r.Id])), clock);

        var stocktakes = new Dictionary<string, Stocktake>();
        foreach (var (k, index) in seed.Stocktakes.Select((k, i) => (k, i)).OrderBy(x => clock.At(x.k.Cr)).ThenBy(x => x.i))
        {
            var created = clock.At(k.Cr);
            var sequence = stocktakes.Values.Count(s => DocCodes.Stem(InventoryRules.StocktakePrefix, s.SnapshotAt) == DocCodes.Stem(InventoryRules.StocktakePrefix, created)) + 1;
            stocktakes[k.Id] = BuildStocktake(k, warehouses, groups, clock, UserOf, DocCodes.Format(InventoryRules.StocktakePrefix, created, sequence));
        }

        // Ghi sổ lại theo thời gian (06 §5.5).
        var supplierNames = suppliers.Values.ToDictionary(s => s.Id, s => s.Name);
        var warehouseById = warehouses.Values.ToDictionary(w => w.Id);
        StockBook? book = null;
        var events = new List<(DateTime At, int Order, Func<Task> Run)>();
        foreach (var r in seed.Receipts.Where(r => r.Ap is not null))
        {
            var doc = receipts[r.Id];
            var origin = doc.ReversalOfIssueId is { } oid ? issues.Values.First(i => i.Id == oid).Code : null;
            events.Add((doc.ApprovedAt!.Value, 0, () => posting.PostReceiptAsync(book!, doc, doc.ApprovedAt!.Value,
                DocumentSupport.ReceiptDescription(doc, doc.SupplierId is { } s ? supplierNames[s] : null, origin), ct)));
        }

        foreach (var x in seed.Issues.Where(x => x.Ap is not null))
        {
            var doc = issues[x.Id];
            var origin = doc.ReversalOfReceiptId is { } oid ? receipts.Values.First(r => r.Id == oid).Code : null;
            events.Add((doc.ApprovedAt!.Value, 0, () => posting.PostIssueAsync(book!, doc, doc.ApprovedAt!.Value,
                DocumentSupport.IssueDescription(doc, doc.SupplierId is { } s ? supplierNames[s] : null, origin), ct)));
        }

        foreach (var t in seed.Transfers)
        {
            var doc = transfers[t.Id];
            var to = warehouseById[doc.ToWarehouseId];
            var from = warehouseById[doc.FromWarehouseId];
            if (doc.ApprovedAt is { } sent)
                events.Add((sent, 0, () => posting.PostTransferOutAsync(book!, doc, sent, $"Chuyển đến {to.Code} – {to.Name}", ct)));
            if (doc.ReceivedAt is { } received)
                events.Add((received, 0, () => posting.PostTransferInAsync(book!, doc, received, $"Nhận từ {from.Code} – {from.Name}", ct)));
        }

        foreach (var k in seed.Stocktakes)
        {
            var doc = stocktakes[k.Id];
            events.Add((doc.SnapshotAt, 1, () =>
            {
                SnapshotStocktake(doc, k, book!, products, groups);
                return Task.CompletedTask;
            }));
            if (doc.ApprovedAt is { } approved)
                events.Add((approved, 0, () => posting.PostStocktakeAsync(book!, doc, approved, ct)));
        }

        book = posting.CreateBook(levels);
        foreach (var (_, _, run) in events.OrderBy(e => e.At).ThenBy(e => e.Order))
            await run();

        db.AddRange(receipts.Values);
        db.AddRange(issues.Values);
        db.AddRange(transfers.Values);
        db.AddRange(stocktakes.Values);
        await db.SaveChangesAsync(ct);
    }

    public async Task ClearAsync(CancellationToken ct = default)
    {
        await db.Set<StockLedgerEntry>().ExecuteDeleteAsync(ct);
        await db.Set<StocktakeCount>().ExecuteDeleteAsync(ct);
        await db.Set<StocktakeLine>().ExecuteDeleteAsync(ct);
        await db.Set<Stocktake>().ExecuteDeleteAsync(ct);
        await db.Set<GoodsReceipt>().ExecuteUpdateAsync(s => s.SetProperty(x => x.ReversalOfIssueId, (Guid?)null), ct);
        await db.Set<GoodsIssue>().ExecuteUpdateAsync(s => s.SetProperty(x => x.ReversalOfReceiptId, (Guid?)null), ct);
        await db.Set<GoodsReceiptLine>().ExecuteDeleteAsync(ct);
        await db.Set<GoodsIssueLine>().ExecuteDeleteAsync(ct);
        await db.Set<TransferLine>().ExecuteDeleteAsync(ct);
        await db.Set<GoodsReceipt>().ExecuteDeleteAsync(ct);
        await db.Set<GoodsIssue>().ExecuteDeleteAsync(ct);
        await db.Set<Transfer>().ExecuteDeleteAsync(ct);
        await db.Set<StockLevel>().ExecuteDeleteAsync(ct);
        await db.Set<ProductUnit>().ExecuteDeleteAsync(ct);
        await db.Set<Product>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<ProductGroup>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<Supplier>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
        await db.Set<WarehouseKeeper>().ExecuteDeleteAsync(ct);
        await db.Set<Warehouse>().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
    }

    private static void ApplyCommon(SeedDocument x, InventoryDocument doc, SeedClock clock, Func<string, User> userOf)
    {
        var creator = userOf(x.By);
        doc.CreatedBy = creator.Id;
        doc.CreatedByName = creator.FullName;
        var created = clock.At(x.Cr);
        doc.SetCreatedAt(created);
        DateTime? last = created;
        doc.SubmittedAt = clock.At(x.Sb2) ?? clock.At(x.Sb);
        last = Max(last, doc.SubmittedAt);
        if (x.Rj is { Count: >= 2 } rj)
        {
            var rejector = userOf(rj[1].GetString()!);
            doc.RejectedAt = clock.At(rj[0]);
            doc.RejectedById = rejector.Id;
            doc.RejectedByName = rejector.FullName;
            doc.RejectReason = rj.Count > 2 ? rj[2].GetString() : null;
            last = Max(last, doc.RejectedAt);
        }

        if (x.Ap is { Count: >= 2 } ap)
        {
            var approver = userOf(ap[1].GetString()!);
            doc.ApprovedAt = clock.At(ap[0]);
            doc.ApprovedById = approver.Id;
            doc.ApprovedByName = approver.FullName;
            last = Max(last, doc.ApprovedAt);
        }

        if (x.Cx is { Count: >= 2 } cx)
        {
            var canceller = userOf(cx[1].GetString()!);
            doc.CancelledAt = clock.At(cx[0]);
            doc.CancelledById = canceller.Id;
            doc.CancelledByName = canceller.FullName;
            last = Max(last, doc.CancelledAt);
        }

        doc.SetUpdatedAt(last == created ? null : last);
    }

    private static DocStatus StatusOf(SeedDocument x) =>
        x.Cx is not null ? DocStatus.DaHuy
        : x.Ap is not null ? DocStatus.DaDuyet
        : x.Rj is not null && x.Sb2 is null ? DocStatus.TuChoi
        : x.Sb is not null ? DocStatus.ChoDuyet
        : DocStatus.Nhap;

    private static void FillLine(DocLine line, int index, List<JsonElement> raw, Dictionary<string, Product> products)
    {
        var product = products[raw[0].GetString()!];
        var unitIndex = raw[1].GetInt32();
        var unit = unitIndex == 0 ? null : product.Units.First(u => u.SortOrder == unitIndex);
        var quantity = raw[2].GetInt32();
        line.LineNo = index + 1;
        line.ProductId = product.Id;
        line.ProductCode = product.Code;
        line.ProductName = product.Name;
        line.BaseUnit = product.BaseUnit;
        line.UnitId = unit?.Id;
        line.UnitName = unit?.Name ?? product.BaseUnit;
        line.Factor = unit?.Factor ?? 1;
        line.Quantity = quantity;
        line.BaseQuantity = StockMath.ToBase(quantity, line.Factor);
    }

    private static GoodsReceipt BuildReceipt(
        SeedReceipt r, Dictionary<string, Warehouse> warehouses, Dictionary<string, Supplier> suppliers,
        Dictionary<string, Product> products, SeedClock clock, Func<string, User> userOf)
    {
        var doc = new GoodsReceipt
        {
            WarehouseId = warehouses[r.W].Id,
            Type = r.T,
            SupplierId = r.S is null ? null : suppliers[r.S].Id,
            DelivererName = r.Dl,
            SourceDocNo = r.Inv is { Count: > 0 } inv ? inv[0].GetString() : null,
            SourceDocDate = r.Inv is { Count: > 1 } inv2 ? clock.DaysAgo(inv2[1].GetInt32()) : null,
            Note = r.Nt,
            FreightCost = r.F ?? 0,
            Status = StatusOf(r)
        };
        ApplyCommon(r, doc, clock, userOf);
        doc.Lines = r.Ln.Select((raw, i) =>
        {
            var line = new GoodsReceiptLine { UnitPrice = raw[3].GetDecimal() };
            FillLine(line, i, raw, products);
            return line;
        }).ToList();
        StockPosting.RecalculateReceipt(doc);
        return doc;
    }

    private static GoodsIssue BuildIssue(
        SeedIssue x, Dictionary<string, Warehouse> warehouses, Dictionary<string, Supplier> suppliers,
        Dictionary<string, Product> products, SeedClock clock, Func<string, User> userOf)
    {
        var doc = new GoodsIssue
        {
            WarehouseId = warehouses[x.W].Id,
            Type = x.T,
            RecipientName = x.Rc,
            SupplierId = x.S is null ? null : suppliers[x.S].Id,
            OrderRef = x.OrderRef,
            Reason = x.Why,
            Status = StatusOf(x)
        };
        ApplyCommon(x, doc, clock, userOf);
        doc.Lines = x.Ln.Select((raw, i) =>
        {
            var line = new GoodsIssueLine();
            FillLine(line, i, raw, products);
            return line;
        }).ToList();
        return doc;
    }

    private static Transfer BuildTransfer(
        SeedTransfer t, Dictionary<string, Warehouse> warehouses, Dictionary<string, Product> products, SeedClock clock, Func<string, User> userOf)
    {
        var doc = new Transfer
        {
            FromWarehouseId = warehouses[t.Fw].Id,
            ToWarehouseId = warehouses[t.Tw].Id,
            Note = t.Nt,
            Status = t.Cx is not null ? TransferStatus.DaHuy
                : t.Re is not null ? TransferStatus.DaNhan
                : t.Ap is not null ? TransferStatus.DangChuyen
                : t.Rj is not null && t.Sb2 is null ? TransferStatus.TuChoi
                : t.Sb is not null ? TransferStatus.ChoDuyet
                : TransferStatus.Nhap
        };
        ApplyCommon(t, doc, clock, userOf);
        doc.Lines = t.Ln.Select((raw, i) =>
        {
            var line = new TransferLine();
            FillLine(line, i, raw, products);
            return line;
        }).ToList();

        if (t.Re is { Count: >= 2 } re)
        {
            var receiver = userOf(re[1].GetString()!);
            doc.ReceivedAt = clock.At(re[0]);
            doc.ReceivedById = receiver.Id;
            doc.ReceivedByName = receiver.FullName;
            doc.SetUpdatedAt(doc.ReceivedAt);
            var shortages = re.Count > 2 && re[2].ValueKind == JsonValueKind.Array
                ? re[2].EnumerateArray().ToDictionary(s => s[0].GetInt32(), s => s[1].GetInt32())
                : [];
            for (var i = 0; i < doc.Lines.Count; i++)
                doc.Lines[i].ReceivedBaseQuantity = doc.Lines[i].BaseQuantity - shortages.GetValueOrDefault(i);
        }

        return doc;
    }

    private static Stocktake BuildStocktake(
        SeedStocktake k, Dictionary<string, Warehouse> warehouses, Dictionary<string, ProductGroup> groups, SeedClock clock,
        Func<string, User> userOf, string code)
    {
        var creator = userOf(k.By);
        var counter = userOf(k.Ct);
        var created = clock.At(k.Cr);
        var scopeAll = k.Sc.ValueKind == JsonValueKind.String;
        var doc = new Stocktake
        {
            Code = code,
            WarehouseId = warehouses[k.W].Id,
            ScopeAll = scopeAll,
            ScopeGroupIds = scopeAll ? null : JsonSerializer.Serialize(k.Sc.EnumerateArray().Select(g => groups[g.GetString()!].Id).ToList()),
            Status = k.Cx is not null ? StocktakeStatus.DaHuy
                : k.Ap is not null ? StocktakeStatus.DaCanBang
                : k.Sb is not null ? StocktakeStatus.ChoDuyet
                : StocktakeStatus.DangKiem,
            SnapshotAt = created,
            CreatedBy = creator.Id,
            CreatedByName = creator.FullName,
            CounterId = counter.Id,
            CounterName = counter.FullName,
            SubmittedAt = clock.At(k.Sb)
        };
        doc.SetCreatedAt(created);
        if (doc.SubmittedAt is not null)
        {
            doc.SubmittedById = counter.Id;
            doc.SubmittedByName = counter.FullName;
        }

        if (k.Ap is { Count: >= 2 } ap)
        {
            var approver = userOf(ap[1].GetString()!);
            doc.ApprovedAt = clock.At(ap[0]);
            doc.ApprovedById = approver.Id;
            doc.ApprovedByName = approver.FullName;
        }

        if (k.Cx is { Count: >= 2 } cx)
        {
            var canceller = userOf(cx[1].GetString()!);
            doc.CancelledAt = clock.At(cx[0]);
            doc.CancelledById = canceller.Id;
            doc.CancelledByName = canceller.FullName;
        }

        return doc;
    }

    /// <summary>06 §5.4 bước 7: dòng = hàng trong phạm vi có tồn ≠ 0 lúc chốt; số đếm = sổ sách + chênh (<c>df</c>).</summary>
    private static void SnapshotStocktake(
        Stocktake doc, SeedStocktake k, StockBook book, Dictionary<string, Product> products, Dictionary<string, ProductGroup> groups)
    {
        var scopeGroups = StockQueries.ParseGroupIds(doc.ScopeGroupIds);
        var diffs = k.Df.ToDictionary(d => d[0].GetString()!, d => d);
        var lines = book.All
            .Where(l => l.WarehouseId == doc.WarehouseId && l.OnHand != 0)
            .Select(l => (Level: l, Product: products.Values.First(p => p.Id == l.ProductId)))
            .Where(x => doc.ScopeAll || scopeGroups.Contains(x.Product.GroupId))
            .OrderBy(x => x.Product.Group!.SortOrder).ThenBy(x => x.Product.Code, StringComparer.Ordinal)
            .ToList();

        var counted = k.Ap is not null || k.Sb is not null;
        doc.Lines = lines.Select((x, i) =>
        {
            var line = new StocktakeLine
            {
                ProductId = x.Product.Id,
                ProductCode = x.Product.Code,
                ProductName = x.Product.Name,
                GroupId = x.Product.GroupId,
                GroupName = x.Product.Group!.Name,
                BaseUnit = x.Product.BaseUnit,
                BookQuantity = x.Level.OnHand,
                BookCost = x.Level.AvgCost,
                SortOrder = i + 1
            };
            if (counted)
            {
                var diff = diffs.TryGetValue(x.Product.Code, out var raw) ? raw[1].GetInt32() : 0;
                line.CountedQuantity = line.BookQuantity + diff;
                line.LastCountedById = doc.CounterId;
                line.LastCountedByName = doc.CounterName;
                line.LastCountedAt = doc.SubmittedAt;
                StocktakeService.ApplyVariance(line, x.Level.StockValue);
                if (raw is not null && raw.Count > 2 && raw[2].ValueKind == JsonValueKind.String)
                {
                    line.Reason = Enum.Parse<VarianceReason>(raw[2].GetString()!);
                    line.ReasonNote = raw.Count > 3 ? raw[3].GetString() : null;
                }
            }

            return line;
        }).ToList();

        var missing = diffs.Keys.Where(c => lines.All(x => x.Product.Code != c)).ToList();
        if (missing.Count > 0)
            throw new InvalidOperationException($"Kiểm kê {k.Id}: mặt hàng chênh lệch không có trong phạm vi: {string.Join(", ", missing)}.");
        if (counted)
            StocktakeService.Totals(doc);
    }

    private static void AssignCodes(string prefix, IEnumerable<(JsonElement? Sb, int Index, InventoryDocument Doc)> docs, SeedClock clock)
    {
        var submitted = docs.Where(d => d.Sb is not null)
            .Select(d => (At: clock.At(d.Sb)!.Value, d.Index, d.Doc))
            .OrderBy(d => d.At).ThenBy(d => d.Index);
        var counters = new Dictionary<string, int>();
        foreach (var (at, _, doc) in submitted)
        {
            var stem = DocCodes.Stem(prefix, at);
            counters[stem] = counters.GetValueOrDefault(stem) + 1;
            doc.Code = DocCodes.Format(prefix, at, counters[stem]);
        }
    }

    private static DateTime? Max(DateTime? a, DateTime? b) => a is null ? b : b is null ? a : a > b ? a : b;
}
