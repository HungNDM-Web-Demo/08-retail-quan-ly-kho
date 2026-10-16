using System.Globalization;
using System.Text.Json;
using Application.Common.Time;
using Application.Constants;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Inventory;
using Application.Interfaces.Services.Roles;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Products;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Phạm vi kho theo quyền <c>warehouses.assign</c> và bảng thủ kho phụ trách (BR-23); lưu tạm trong một request.</summary>
public sealed class WarehouseScope(
    ICurrentUserService currentUser,
    IPermissionService permissions,
    IGenericRepository<User> users,
    IGenericRepository<Warehouse> warehouses) : IWarehouseScope
{
    private InventoryActor? _actor;

    public async Task<InventoryActor> GetActorAsync(CancellationToken ct = default)
    {
        if (_actor is not null)
            return _actor;

        if (currentUser.UserId is not { } userId)
            throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");

        var user = await users.QueryNoTracking().Where(u => u.Id == userId)
            .Select(u => new { u.Username, u.FullName }).FirstOrDefaultAsync(ct)
            ?? throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");
        var access = await permissions.GetUserAccessAsync(userId, ct);
        var assigned = await warehouses.QueryNoTracking()
            .Where(w => w.Keepers.Any(k => k.UserId == userId))
            .Select(w => w.Id)
            .ToListAsync(ct);

        _actor = new InventoryActor
        {
            UserId = userId,
            Username = user.Username,
            FullName = user.FullName,
            Access = access,
            AllWarehouses = access.HasPermission(ProjectPermissions.Warehouses.Assign),
            AssignedWarehouseIds = assigned.ToHashSet()
        };
        return _actor;
    }

    public async Task<IReadOnlyList<WarehouseOption>> GetWarehousesAsync(CancellationToken ct = default)
    {
        var actor = await GetActorAsync(ct);
        var list = await warehouses.QueryNoTracking()
            .OrderBy(w => w.SortOrder).ThenBy(w => w.Code)
            .Select(w => new WarehouseOption(w.Id, w.Code, w.Name, w.IsActive))
            .ToListAsync(ct);
        return list.Where(w => actor.InScope(w.Id)).ToList();
    }
}

/// <summary>Cấp mã chứng từ: số lớn nhất cùng tiền tố, cùng ngày (giờ Việt Nam) + 1 (07 §3.12).</summary>
public sealed class DocumentCodeGenerator(
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<Transfer> transfers,
    IGenericRepository<Stocktake> stocktakes) : IDocumentCodeGenerator
{
    public async Task<string> NextAsync(string prefix, DateTime atUtc, CancellationToken ct = default)
    {
        var stem = DocCodes.Stem(prefix, atUtc);
        var codes = prefix switch
        {
            InventoryRules.ReceiptPrefix => await receipts.QueryNoTracking().Where(x => x.Code != null && x.Code.StartsWith(stem)).Select(x => x.Code!).ToListAsync(ct),
            InventoryRules.IssuePrefix => await issues.QueryNoTracking().Where(x => x.Code != null && x.Code.StartsWith(stem)).Select(x => x.Code!).ToListAsync(ct),
            InventoryRules.TransferPrefix => await transfers.QueryNoTracking().Where(x => x.Code != null && x.Code.StartsWith(stem)).Select(x => x.Code!).ToListAsync(ct),
            _ => await stocktakes.QueryNoTracking().Where(x => x.Code.StartsWith(stem)).Select(x => x.Code).ToListAsync(ct)
        };

        var max = codes
            .Select(c => int.TryParse(c[stem.Length..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();
        return DocCodes.Format(prefix, atUtc, max + 1);
    }
}

/// <summary>Định dạng mã chứng từ, dùng chung cho service và seeder.</summary>
public static class DocCodes
{
    public static string Stem(string prefix, DateTime atUtc) =>
        prefix + VietnamDates.ToVietnam(atUtc).ToString("yyMMdd", CultureInfo.InvariantCulture);

    public static string Format(string prefix, DateTime atUtc, int sequence) =>
        Stem(prefix, atUtc) + sequence.ToString(prefix == InventoryRules.StocktakePrefix ? "D2" : "D3", CultureInfo.InvariantCulture);
}

/// <summary>Hiện thực lõi ghi sổ (BR-11) trên <see cref="StockPosting"/>.</summary>
public sealed class StockPostingService(
    IGenericRepository<StockLevel> levels,
    IGenericRepository<StockLedgerEntry> ledger) : IStockPostingService
{
    private readonly List<StockLevel> _created = [];

    public async Task<StockBook> LoadBookAsync(IEnumerable<(Guid WarehouseId, Guid ProductId)> keys, CancellationToken ct = default)
    {
        var list = keys.Distinct().ToList();
        var warehouseIds = list.Select(k => k.WarehouseId).Distinct().ToList();
        var productIds = list.Select(k => k.ProductId).Distinct().ToList();
        var loaded = await levels.Query()
            .Where(l => warehouseIds.Contains(l.WarehouseId) && productIds.Contains(l.ProductId))
            .ToListAsync(ct);
        return new StockBook(loaded, _created.Add);
    }

    public StockBook CreateBook(IEnumerable<StockLevel> existing) => new(existing, _created.Add);

    public Task PostReceiptAsync(StockBook book, GoodsReceipt doc, DateTime at, string description, CancellationToken ct = default) =>
        FlushAsync(StockPosting.Receipt(book, doc, at, description), ct);

    public Task PostIssueAsync(StockBook book, GoodsIssue doc, DateTime at, string description, CancellationToken ct = default) =>
        FlushAsync(StockPosting.Issue(book, doc, at, description), ct);

    public Task PostTransferOutAsync(StockBook book, Transfer doc, DateTime at, string description, CancellationToken ct = default) =>
        FlushAsync(StockPosting.TransferOut(book, doc, at, description), ct);

    public Task PostTransferInAsync(StockBook book, Transfer doc, DateTime at, string description, CancellationToken ct = default) =>
        FlushAsync(StockPosting.TransferIn(book, doc, at, description), ct);

    public Task PostStocktakeAsync(StockBook book, Stocktake doc, DateTime at, CancellationToken ct = default) =>
        FlushAsync(StockPosting.Stocktake(book, doc, at), ct);

    private async Task FlushAsync(List<StockLedgerEntry> entries, CancellationToken ct)
    {
        if (_created.Count > 0)
        {
            await levels.AddRangeAsync(_created.ToList(), ct);
            _created.Clear();
        }

        await ledger.AddRangeAsync(entries, ct);
    }
}

/// <summary>Giữ chỗ (BR-03) và khóa kiểm kê (BR-14) tính khi đọc, không lưu cờ (quyết định 16, 19).</summary>
public sealed class StockQueries(
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<Transfer> transfers,
    IGenericRepository<Stocktake> stocktakes,
    IGenericRepository<Product> products) : IStockQueries
{
    public async Task<Dictionary<Guid, int>> ReservedAsync(Guid warehouseId, IReadOnlyCollection<Guid>? productIds = null, CancellationToken ct = default)
    {
        var issueLines = issues.QueryNoTracking()
            .Where(d => d.Status == DocStatus.ChoDuyet && d.WarehouseId == warehouseId)
            .SelectMany(d => d.Lines).Select(l => new { l.ProductId, l.BaseQuantity });
        var transferLines = transfers.QueryNoTracking()
            .Where(d => d.Status == TransferStatus.ChoDuyet && d.FromWarehouseId == warehouseId)
            .SelectMany(d => d.Lines).Select(l => new { l.ProductId, l.BaseQuantity });
        if (productIds is not null)
        {
            issueLines = issueLines.Where(l => productIds.Contains(l.ProductId));
            transferLines = transferLines.Where(l => productIds.Contains(l.ProductId));
        }

        var all = (await issueLines.ToListAsync(ct)).Concat(await transferLines.ToListAsync(ct));
        return all.GroupBy(l => l.ProductId).ToDictionary(g => g.Key, g => g.Sum(l => l.BaseQuantity));
    }

    public async Task<Dictionary<(Guid WarehouseId, Guid ProductId), int>> ReservedAllAsync(CancellationToken ct = default)
    {
        var issueLines = await issues.QueryNoTracking()
            .Where(d => d.Status == DocStatus.ChoDuyet)
            .SelectMany(d => d.Lines, (d, l) => new { d.WarehouseId, l.ProductId, l.BaseQuantity })
            .ToListAsync(ct);
        var transferLines = await transfers.QueryNoTracking()
            .Where(d => d.Status == TransferStatus.ChoDuyet)
            .SelectMany(d => d.Lines, (d, l) => new { WarehouseId = d.FromWarehouseId, l.ProductId, l.BaseQuantity })
            .ToListAsync(ct);
        return issueLines.Concat(transferLines)
            .GroupBy(l => (l.WarehouseId, l.ProductId))
            .ToDictionary(g => g.Key, g => g.Sum(l => l.BaseQuantity));
    }

    public async Task<StocktakeLock?> FindLockAsync(Guid warehouseId, IReadOnlyCollection<Guid> productIds, CancellationToken ct = default)
    {
        var open = await stocktakes.QueryNoTracking()
            .Where(s => s.WarehouseId == warehouseId && (s.Status == StocktakeStatus.DangKiem || s.Status == StocktakeStatus.ChoDuyet))
            .Select(s => new { s.Id, s.Code, s.ScopeAll, s.ScopeGroupIds, LineProducts = s.Lines.Select(l => l.ProductId).ToList() })
            .ToListAsync(ct);
        if (open.Count == 0 || productIds.Count == 0)
            return null;

        var groupOf = await products.QueryNoTracking().IgnoreQueryFilters()
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.GroupId, ct);
        foreach (var stocktake in open)
        {
            var groups = ParseGroupIds(stocktake.ScopeGroupIds);
            var locked = productIds
                .Where(p => stocktake.ScopeAll
                    || stocktake.LineProducts.Contains(p)
                    || (groupOf.TryGetValue(p, out var g) && groups.Contains(g)))
                .ToList();
            if (locked.Count > 0)
                return new StocktakeLock(stocktake.Id, stocktake.Code, locked);
        }

        return null;
    }

    public static HashSet<Guid> ParseGroupIds(string? json) =>
        string.IsNullOrWhiteSpace(json) ? [] : (JsonSerializer.Deserialize<List<Guid>>(json) ?? []).ToHashSet();
}
