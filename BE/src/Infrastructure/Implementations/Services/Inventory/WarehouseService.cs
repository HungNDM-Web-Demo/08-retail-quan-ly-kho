using System.Text.RegularExpressions;
using Application.Common.Exceptions;
using Application.Constants;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Stock;
using Domain.Entities.Inventory.Stocktakes;
using Domain.Entities.Inventory.Transfers;
using Domain.Entities.Inventory.Warehouses;
using Domain.Entities.System.Roles;
using Domain.Entities.System.Users;
using Domain.Enums.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Kho, thủ kho phụ trách (UC-02; FR-04, FR-05; BR-23, BR-24; 07 §2.1).</summary>
public sealed partial class WarehouseService(
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<StockLevel> levels,
    IGenericRepository<StockLedgerEntry> ledger,
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<GoodsIssue> issues,
    IGenericRepository<Transfer> transfers,
    IGenericRepository<Stocktake> stocktakes,
    IGenericRepository<User> users,
    IGenericRepository<Role> roles,
    IUnitOfWork unitOfWork,
    IWarehouseScope scope) : IWarehouseService
{
    public async Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var list = await warehouses.QueryNoTracking().Include(w => w.Keepers)
            .OrderBy(w => w.SortOrder).ThenBy(w => w.Code).ToListAsync(ct);
        list = list.Where(w => actor.InScope(w.Id)).ToList();
        return await ToDtosAsync(list, actor, ct);
    }

    public Task<IReadOnlyList<WarehouseOption>> GetMyAsync(CancellationToken ct = default) => scope.GetWarehousesAsync(ct);

    public async Task<IReadOnlyList<WarehouseOption>> GetOptionsAsync(CancellationToken ct = default) =>
        await warehouses.QueryNoTracking().Where(w => w.IsActive)
            .OrderBy(w => w.SortOrder).ThenBy(w => w.Code)
            .Select(w => new WarehouseOption(w.Id, w.Code, w.Name, w.IsActive))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<KeeperCandidate>> GetKeeperCandidatesAsync(CancellationToken ct = default)
    {
        var staffRoleId = await roles.QueryNoTracking().Where(r => r.Code == RoleCodes.Staff).Select(r => r.Id).FirstOrDefaultAsync(ct);
        var staff = await users.QueryNoTracking()
            .Where(u => u.IsActive && u.UserRoles.Any(r => r.RoleId == staffRoleId))
            .OrderBy(u => u.FullName)
            .Select(u => new { u.Id, u.Username, u.FullName })
            .ToListAsync(ct);
        var assignments = await warehouses.QueryNoTracking()
            .OrderBy(w => w.SortOrder)
            .SelectMany(w => w.Keepers.Select(k => new { k.UserId, w.Code }))
            .ToListAsync(ct);
        return staff.Select(u => new KeeperCandidate(u.Id, u.Username, u.FullName,
            assignments.Where(a => a.UserId == u.Id).Select(a => a.Code).ToList())).ToList();
    }

    public async Task<WarehouseDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var warehouse = await warehouses.QueryNoTracking().Include(w => w.Keepers).FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy kho.");
        if (!actor.InScope(id))
            throw InventoryProblems.NotKeeper(warehouse.Code);
        return (await ToDtosAsync([warehouse], actor, ct))[0];
    }

    public async Task<WarehouseDto> CreateAsync(SaveWarehouseRequest request, CancellationToken ct = default)
    {
        var (code, name) = Validate(request);
        if (await warehouses.AnyAsync(w => w.Code == code, ct))
            throw new ConflictException("Mã kho đã tồn tại", "code");

        var maxOrder = await warehouses.QueryNoTracking().IgnoreQueryFilters().MaxAsync(w => (int?)w.SortOrder, ct) ?? 0;
        var warehouse = new Warehouse
        {
            Code = code,
            Name = name,
            Address = DocumentSupport.Limit(request.Address, 250),
            Phone = DocumentSupport.Limit(request.Phone, 20),
            SortOrder = maxOrder + 10
        };
        await warehouses.AddAsync(warehouse, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(warehouse.Id, ct);
    }

    public async Task<WarehouseDto> UpdateAsync(Guid id, SaveWarehouseRequest request, CancellationToken ct = default)
    {
        var (code, name) = Validate(request);
        var warehouse = await warehouses.Query().FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy kho.");
        if (code != warehouse.Code)
        {
            if (await HasDocumentsAsync(id, ct))
                throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("code", "Kho đã có chứng từ, không đổi mã được")]);
            if (await warehouses.AnyAsync(w => w.Code == code && w.Id != id, ct))
                throw new ConflictException("Mã kho đã tồn tại", "code");
        }

        warehouse.Code = code;
        warehouse.Name = name;
        warehouse.Address = DocumentSupport.Limit(request.Address, 250);
        warehouse.Phone = DocumentSupport.Limit(request.Phone, 20);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<WarehouseDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default)
    {
        var warehouse = await warehouses.Query().FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy kho.");
        if (!request.IsActive && warehouse.IsActive)
        {
            var productCount = await levels.QueryNoTracking().CountAsync(l => l.WarehouseId == id && l.OnHand > 0, ct);
            var openCount = (await OpenDocumentCountsAsync([id], ct)).GetValueOrDefault(id);
            if (productCount > 0 || openCount > 0)
            {
                throw InventoryErrors.Business(InventoryErrors.KhoConTon,
                    InventoryErrors.WarehouseHasStock(warehouse.Code, productCount, openCount),
                    new Dictionary<string, object?> { ["productCount"] = productCount, ["openDocumentCount"] = openCount });
            }
        }

        warehouse.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<WarehouseDto> AssignKeepersAsync(Guid id, AssignKeepersRequest request, CancellationToken ct = default)
    {
        var warehouse = await warehouses.Query().Include(w => w.Keepers).FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy kho.");
        var ids = request.UserIds.Distinct().ToList();
        var candidates = (await GetKeeperCandidatesAsync(ct)).Select(c => c.Id).ToHashSet();
        if (ids.Any(u => !candidates.Contains(u)))
        {
            throw new FluentValidation.ValidationException(
                [new FluentValidation.Results.ValidationFailure("userIds", "Chỉ gán tài khoản vai trò Thủ kho đang hoạt động")]);
        }

        warehouse.Keepers.RemoveAll(k => !ids.Contains(k.UserId));
        foreach (var userId in ids.Where(u => warehouse.Keepers.All(k => k.UserId != u)))
            warehouse.Keepers.Add(new WarehouseKeeper { WarehouseId = id, UserId = userId });
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var warehouse = await warehouses.Query().FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy kho.");
        if (await HasDocumentsAsync(id, ct) || await levels.AnyAsync(l => l.WarehouseId == id && l.OnHand != 0, ct))
            throw InventoryErrors.Business(InventoryErrors.DaCoChungTu, InventoryErrors.HasDocuments("Kho"));
        warehouses.Delete(warehouse);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static (string Code, string Name) Validate(SaveWarehouseRequest request)
    {
        var errors = new FieldErrorBag();
        var code = request.Code?.Trim() ?? string.Empty;
        var name = request.Name?.Trim() ?? string.Empty;
        if (!CodePattern().IsMatch(code))
            errors.Add("code", "Mã kho 2–10 ký tự chữ in hoa và số");
        if (name.Length == 0)
            errors.Add("name", "Nhập tên kho");
        else if (name.Length > 100)
            errors.Add("name", "Tên kho tối đa 100 ký tự");
        if (!string.IsNullOrWhiteSpace(request.Phone) && !DocumentSupport.IsPhone(request.Phone))
            errors.Add("phone", DocumentSupport.PhoneMessage);
        errors.ThrowIfAny();
        return (code, name);
    }

    private async Task<bool> HasDocumentsAsync(Guid id, CancellationToken ct) =>
        await receipts.AnyAsync(x => x.WarehouseId == id, ct)
        || await issues.AnyAsync(x => x.WarehouseId == id, ct)
        || await transfers.AnyAsync(x => x.FromWarehouseId == id || x.ToWarehouseId == id, ct)
        || await stocktakes.AnyAsync(x => x.WarehouseId == id, ct)
        || await ledger.AnyAsync(x => x.WarehouseId == id, ct);

    /// <summary>"Phiếu chưa kết thúc" của kho (06 §4 Inventory_Warehouses).</summary>
    private async Task<Dictionary<Guid, int>> OpenDocumentCountsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct)
    {
        var open = new[] { DocStatus.Nhap, DocStatus.ChoDuyet, DocStatus.TuChoi };
        var openTransfer = new[] { TransferStatus.Nhap, TransferStatus.ChoDuyet, TransferStatus.TuChoi, TransferStatus.DangChuyen };
        var r = await receipts.QueryNoTracking().Where(x => ids.Contains(x.WarehouseId) && open.Contains(x.Status)).Select(x => x.WarehouseId).ToListAsync(ct);
        var i = await issues.QueryNoTracking().Where(x => ids.Contains(x.WarehouseId) && open.Contains(x.Status)).Select(x => x.WarehouseId).ToListAsync(ct);
        var t = await transfers.QueryNoTracking().Where(x => openTransfer.Contains(x.Status) && (ids.Contains(x.FromWarehouseId) || ids.Contains(x.ToWarehouseId)))
            .Select(x => new { x.FromWarehouseId, x.ToWarehouseId }).ToListAsync(ct);
        var s = await stocktakes.QueryNoTracking()
            .Where(x => ids.Contains(x.WarehouseId) && (x.Status == StocktakeStatus.DangKiem || x.Status == StocktakeStatus.ChoDuyet))
            .Select(x => x.WarehouseId).ToListAsync(ct);
        return ids.ToDictionary(id => id, id =>
            r.Count(x => x == id) + i.Count(x => x == id) + s.Count(x => x == id)
            + t.Count(x => x.FromWarehouseId == id || x.ToWarehouseId == id));
    }

    private async Task<IReadOnlyList<WarehouseDto>> ToDtosAsync(List<Warehouse> list, Application.Interfaces.Services.Inventory.InventoryActor actor, CancellationToken ct)
    {
        var ids = list.Select(w => w.Id).ToList();
        var stock = await levels.QueryNoTracking().Where(l => ids.Contains(l.WarehouseId))
            .GroupBy(l => l.WarehouseId)
            .Select(g => new { WarehouseId = g.Key, Count = g.Count(l => l.OnHand > 0), Value = g.Sum(l => l.StockValue) })
            .ToDictionaryAsync(x => x.WarehouseId, ct);
        var open = await OpenDocumentCountsAsync(ids, ct);
        var keeperIds = list.SelectMany(w => w.Keepers.Select(k => k.UserId)).Distinct().ToList();
        var keeperMap = await users.QueryNoTracking().Where(u => keeperIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new UserRef(u.Id, u.Username, u.FullName), ct);
        var result = new List<WarehouseDto>();
        foreach (var w in list)
        {
            result.Add(new WarehouseDto
            {
                Id = w.Id,
                Code = w.Code,
                Name = w.Name,
                Address = w.Address,
                Phone = w.Phone,
                IsActive = w.IsActive,
                SortOrder = w.SortOrder,
                Keepers = w.Keepers.Where(k => keeperMap.ContainsKey(k.UserId)).Select(k => keeperMap[k.UserId]).OrderBy(k => k.FullName).ToList(),
                StockedProductCount = stock.GetValueOrDefault(w.Id)?.Count ?? 0,
                StockValue = actor.CanViewValues ? stock.GetValueOrDefault(w.Id)?.Value ?? 0 : null,
                OpenDocumentCount = open.GetValueOrDefault(w.Id),
                HasDocuments = await HasDocumentsAsync(w.Id, ct)
            });
        }

        return result;
    }

    [GeneratedRegex(@"^[A-Z0-9]{2,10}$")]
    private static partial Regex CodePattern();

}
