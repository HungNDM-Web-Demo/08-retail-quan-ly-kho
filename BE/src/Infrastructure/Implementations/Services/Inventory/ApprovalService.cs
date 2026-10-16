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

/// <summary>Phiếu chờ duyệt (UC-05 bước 1; 07 §2.7): mọi phiếu Chờ duyệt loại người gọi duyệt được, gửi trước lên trước.</summary>
public sealed class ApprovalService(
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<Transfer> transfers,
    IGenericRepository<Stocktake> stocktakes,
    IGenericRepository<StockLevel> levels,
    IGenericRepository<ProductGroup> groups,
    IGenericRepository<Warehouse> warehouses,
    IWarehouseScope scope) : IApprovalService
{
    public async Task<IReadOnlyList<ApprovalItem>> GetPendingAsync(ApprovalQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var names = await DocumentSupport.WarehousesAsync(warehouses, ct);
        string Code(Guid id) => names.GetValueOrDefault(id)?.Code ?? string.Empty;
        bool Wanted(DocKind kind, string permission) => (query.Kind is null || query.Kind == kind) && actor.Can(permission);
        var canView = actor.CanViewValues;
        var costs = canView
            ? await levels.QueryNoTracking().ToDictionaryAsync(l => (l.WarehouseId, l.ProductId), l => l.AvgCost, ct)
            : [];
        decimal? Estimate(Guid warehouseId, IEnumerable<Domain.Entities.Inventory.Documents.DocLine> lines) =>
            canView ? lines.Sum(l => l.BaseQuantity * costs.GetValueOrDefault((warehouseId, l.ProductId))) : null;

        var items = new List<ApprovalItem>();
        if (Wanted(DocKind.GoodsReceipt, ProjectPermissions.GoodsReceipts.Approve))
        {
            var docs = await receipts.QueryNoTracking().Include(x => x.Lines).Where(x => x.Status == DocStatus.ChoDuyet).ToListAsync(ct);
            items.AddRange(docs.Where(d => actor.InScope(d.WarehouseId)).Select(d => Item(DocKind.GoodsReceipt, d, d.WarehouseId, null,
                $"Phiếu nhập · {InventoryRules.Label(d.Type)}", d.Lines.Count, canView ? d.TotalValue : null, actor, Code)));
        }

        if (Wanted(DocKind.GoodsIssue, ProjectPermissions.GoodsIssues.Approve))
        {
            var docs = await issues.QueryNoTracking().Include(x => x.Lines).Where(x => x.Status == DocStatus.ChoDuyet).ToListAsync(ct);
            items.AddRange(docs.Where(d => actor.InScope(d.WarehouseId)).Select(d => Item(DocKind.GoodsIssue, d, d.WarehouseId, null,
                $"Phiếu xuất · {InventoryRules.Label(d.Type)}", d.Lines.Count, Estimate(d.WarehouseId, d.Lines), actor, Code)));
        }

        if (Wanted(DocKind.Transfer, ProjectPermissions.Transfers.Approve))
        {
            var docs = await transfers.QueryNoTracking().Include(x => x.Lines).Where(x => x.Status == TransferStatus.ChoDuyet).ToListAsync(ct);
            items.AddRange(docs.Where(d => actor.InScope(d.FromWarehouseId)).Select(d => Item(DocKind.Transfer, d, d.FromWarehouseId, d.ToWarehouseId,
                $"Chuyển kho {Code(d.FromWarehouseId)} → {Code(d.ToWarehouseId)}", d.Lines.Count, Estimate(d.FromWarehouseId, d.Lines), actor, Code)));
        }

        if (Wanted(DocKind.Stocktake, ProjectPermissions.Stocktakes.Approve))
        {
            var groupNames = await groups.QueryNoTracking().IgnoreQueryFilters().ToDictionaryAsync(g => g.Id, g => g.Name, ct);
            var docs = await stocktakes.QueryNoTracking().Include(x => x.Lines).Include(x => x.Counts).AsSplitQuery()
                .Where(x => x.Status == StocktakeStatus.ChoDuyet).ToListAsync(ct);
            foreach (var d in docs.Where(d => actor.InScope(d.WarehouseId)))
            {
                var blocked = d.CounterId == actor.UserId || d.Counts.Any(c => c.CountedById == actor.UserId);
                var scopeText = d.ScopeAll
                    ? "Toàn kho"
                    : string.Join(", ", StockQueries.ParseGroupIds(d.ScopeGroupIds).Select(g => groupNames.GetValueOrDefault(g) ?? string.Empty));
                items.Add(new ApprovalItem
                {
                    Kind = DocKind.Stocktake,
                    Id = d.Id,
                    Code = d.Code,
                    TypeText = $"Kiểm kê · {scopeText}",
                    WarehouseCode = Code(d.WarehouseId),
                    CreatedById = d.CreatedBy ?? Guid.Empty,
                    CreatedByName = d.CreatedByName,
                    SubmittedAt = d.SubmittedAt ?? d.CreatedAt,
                    LineCount = d.Lines.Count,
                    TotalValue = canView ? (d.SurplusValue ?? 0) - (d.ShortageValue ?? 0) : null,
                    CanApprove = !blocked,
                    BlockedReason = blocked ? InventoryErrors.SameCounterMessage : null,
                    Version = d.Version
                });
            }
        }

        return items
            .Where(i => query.WarehouseId is not { } w || i.WarehouseCode == Code(w) || i.ToWarehouseCode == Code(w))
            .Where(i => query.CreatedById is not { } c || i.CreatedById == c)
            .OrderBy(i => i.SubmittedAt)
            .ToList();
    }

    private static ApprovalItem Item(
        DocKind kind, Domain.Entities.Inventory.Documents.InventoryDocument d, Guid warehouseId, Guid? toWarehouseId, string typeText,
        int lineCount, decimal? totalValue, InventoryActor actor, Func<Guid, string> code)
    {
        var blocked = d.CreatedBy == actor.UserId;
        return new ApprovalItem
        {
            Kind = kind,
            Id = d.Id,
            Code = d.Code,
            TypeText = typeText,
            WarehouseCode = code(warehouseId),
            ToWarehouseCode = toWarehouseId is { } to ? code(to) : null,
            CreatedById = d.CreatedBy ?? Guid.Empty,
            CreatedByName = d.CreatedByName,
            SubmittedAt = d.SubmittedAt ?? d.CreatedAt,
            LineCount = lineCount,
            TotalValue = totalValue,
            CanApprove = !blocked,
            BlockedReason = blocked ? InventoryErrors.SameApproverMessage : null,
            Version = d.Version
        };
    }
}
