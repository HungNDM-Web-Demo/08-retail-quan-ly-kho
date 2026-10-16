using System.Text.RegularExpressions;
using Application.Common.Exceptions;
using Application.Common.Models;
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
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Nhóm hàng (FR-06; 07 §2.3).</summary>
public sealed partial class ProductGroupService(
    IGenericRepository<ProductGroup> groups,
    IGenericRepository<Product> products,
    IUnitOfWork unitOfWork) : IProductGroupService
{
    public async Task<IReadOnlyList<ProductGroupDto>> GetAllAsync(CancellationToken ct = default)
    {
        var counts = await products.QueryNoTracking().GroupBy(p => p.GroupId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var list = await groups.QueryNoTracking().OrderBy(g => g.SortOrder).ThenBy(g => g.Code).ToListAsync(ct);
        return list.Select(g => ToDto(g, counts.GetValueOrDefault(g.Id))).ToList();
    }

    public async Task<ProductGroupDto> CreateAsync(SaveProductGroupRequest request, CancellationToken ct = default)
    {
        var (code, name, color) = Validate(request);
        if (await groups.AnyAsync(g => g.Code == code, ct))
            throw new ConflictException("Mã nhóm hàng đã tồn tại", "code");
        var maxOrder = await groups.QueryNoTracking().IgnoreQueryFilters().MaxAsync(g => (int?)g.SortOrder, ct) ?? 0;
        var group = new ProductGroup { Code = code, Name = name, Color = color, SortOrder = maxOrder + 10 };
        await groups.AddAsync(group, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(group, 0);
    }

    public async Task<ProductGroupDto> UpdateAsync(Guid id, SaveProductGroupRequest request, CancellationToken ct = default)
    {
        var (code, name, color) = Validate(request);
        var group = await groups.Query().FirstOrDefaultAsync(g => g.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy nhóm hàng.");
        if (code != group.Code && await groups.AnyAsync(g => g.Code == code && g.Id != id, ct))
            throw new ConflictException("Mã nhóm hàng đã tồn tại", "code");
        group.Code = code;
        group.Name = name;
        group.Color = color;
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(group, await products.QueryNoTracking().CountAsync(p => p.GroupId == id, ct));
    }

    public async Task<ProductGroupDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default)
    {
        var group = await groups.Query().FirstOrDefaultAsync(g => g.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy nhóm hàng.");
        group.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(group, await products.QueryNoTracking().CountAsync(p => p.GroupId == id, ct));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var group = await groups.Query().FirstOrDefaultAsync(g => g.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy nhóm hàng.");
        var count = await products.QueryNoTracking().CountAsync(p => p.GroupId == id, ct);
        if (count > 0)
        {
            throw InventoryErrors.Business(InventoryErrors.NhomConHang, InventoryErrors.GroupHasProducts(count),
                new Dictionary<string, object?> { ["productCount"] = count });
        }

        groups.Delete(group);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static (string Code, string Name, string Color) Validate(SaveProductGroupRequest request)
    {
        var errors = new FieldErrorBag();
        var code = request.Code?.Trim() ?? string.Empty;
        if (!GroupCodePattern().IsMatch(code))
            errors.Add("code", "Mã nhóm 2–20 ký tự chữ in hoa và số");
        if (string.IsNullOrWhiteSpace(request.Name))
            errors.Add("name", "Nhập tên nhóm hàng");
        var color = request.Color?.Trim() ?? string.Empty;
        if (!ColorPattern().IsMatch(color))
            errors.Add("color", "Chọn màu dạng #RRGGBB");
        errors.ThrowIfAny();
        return (code, request.Name!.Trim(), color.ToUpperInvariant());
    }

    private static ProductGroupDto ToDto(ProductGroup g, int count) =>
        new(g.Id, g.Code, g.Name, g.Color, g.IsActive, g.SortOrder, count);

    [GeneratedRegex(@"^[A-Z0-9]{2,20}$")]
    private static partial Regex GroupCodePattern();

    [GeneratedRegex(@"^#[0-9A-Fa-f]{6}$")]
    private static partial Regex ColorPattern();
}

/// <summary>Mặt hàng, đơn vị quy đổi, ngưỡng tồn (UC-01; FR-07, FR-09; BR-01, BR-02, BR-18; 07 §2.3).</summary>
public sealed partial class ProductService(
    IGenericRepository<Product> products,
    IGenericRepository<ProductGroup> groups,
    IGenericRepository<ProductUnit> units,
    IGenericRepository<StockLevel> levels,
    IGenericRepository<StockLedgerEntry> ledger,
    IGenericRepository<Warehouse> warehouses,
    IGenericRepository<GoodsReceiptLine> receiptLines,
    IGenericRepository<GoodsIssueLine> issueLines,
    IGenericRepository<TransferLine> transferLines,
    IGenericRepository<StocktakeLine> stocktakeLines,
    IUnitOfWork unitOfWork,
    IWarehouseScope scope,
    IStockQueries stockQueries) : IProductService
{
    public async Task<PaginatedResult<ProductDto>> GetPagedAsync(ProductQuery query, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var source = products.QueryNoTracking();
        if (query.GroupId is { } groupId)
            source = source.Where(p => p.GroupId == groupId);
        if (query.IsActive is { } active)
            source = source.Where(p => p.IsActive == active);
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            var plain = LikePattern.Contains(TextSearch.Normalize(term));
            source = source.Where(p => AppDbFunctions.Matches(p.SearchText, plain)
                || AppDbFunctions.Matches(p.Code, pattern) || AppDbFunctions.Matches(p.Name, pattern));
        }

        if (string.IsNullOrWhiteSpace(query.SortBy))
        {
            query.SortBy = "code";
            query.SortDir ??= "asc";
        }

        var page = await source.Include(p => p.Units).Include(p => p.Group).AsSplitQuery().ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var context = await LoadContextAsync(page.Items.Select(p => p.Id).ToList(), actor, ct);
        return page.Map(items => items.Select(p => (ProductDto)ToDetail(p, context, withLevels: false)).ToList());
    }

    public async Task<IReadOnlyList<CatalogProduct>> GetCatalogAsync(CancellationToken ct = default)
    {
        var list = await products.QueryNoTracking().Include(p => p.Units).OrderBy(p => p.Code).ToListAsync(ct);
        return list.Select(ToCatalog).ToList();
    }

    public async Task<BarcodeMatch> FindByBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        var code = barcode.Trim();
        var product = await products.QueryNoTracking().Include(p => p.Units)
            .FirstOrDefaultAsync(p => p.Barcode == code || p.Units.Any(u => u.Barcode == code), ct)
            ?? throw InventoryProblems.BarcodeNotFound(code);
        var unit = product.Units.FirstOrDefault(u => u.Barcode == code);
        return new BarcodeMatch(ToCatalog(product), unit?.Id);
    }

    public async Task<ProductDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var actor = await scope.GetActorAsync(ct);
        var product = await products.QueryNoTracking().Include(p => p.Units).Include(p => p.Group).FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy mặt hàng.");
        var context = await LoadContextAsync([id], actor, ct);
        return ToDetail(product, context, withLevels: true);
    }

    public async Task<ProductDetailDto> CreateAsync(SaveProductRequest request, CancellationToken ct = default)
    {
        var product = new Product();
        await SaveAsync(product, request, isNew: true, ct);
        return await GetAsync(product.Id, ct);
    }

    public async Task<ProductDetailDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken ct = default)
    {
        var product = await products.Query().Include(p => p.Units).FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy mặt hàng.");
        await SaveAsync(product, request, isNew: false, ct);
        return await GetAsync(id, ct);
    }

    public async Task<ProductDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default)
    {
        var product = await products.Query().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy mặt hàng.");
        product.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var product = await products.Query().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy mặt hàng.");
        if (await HasDocumentsAsync(id, ct))
            throw InventoryErrors.Business(InventoryErrors.DaCoChungTu, InventoryErrors.HasDocuments("Mặt hàng"));
        products.Delete(product);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task SaveAsync(Product product, SaveProductRequest request, bool isNew, CancellationToken ct)
    {
        // 1. Định dạng (400).
        var errors = new FieldErrorBag();
        var code = request.Code?.Trim() ?? string.Empty;
        if (!ProductCodePattern().IsMatch(code))
            errors.Add("code", "Mã hàng 3–20 ký tự gồm chữ in hoa, số, dấu -");
        if (string.IsNullOrWhiteSpace(request.Name))
            errors.Add("name", "Nhập tên mặt hàng");
        if (string.IsNullOrWhiteSpace(request.BaseUnit))
            errors.Add("baseUnit", "Nhập đơn vị cơ bản");
        var barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        if (barcode is not null && !BarcodePattern().IsMatch(barcode))
            errors.Add("barcode", "Mã vạch chỉ gồm chữ số, dài 8–14 ký tự");
        if (request.Units.Count > InventoryRules.MaxUnits)
            errors.Add("units", "Tối đa 2 đơn vị quy đổi");
        for (var i = 0; i < request.Units.Count; i++)
        {
            var unit = request.Units[i];
            if (string.IsNullOrWhiteSpace(unit.Name))
                errors.Add($"units[{i}].name", "Nhập tên đơn vị");
            if (unit.Factor < InventoryRules.MinFactor || unit.Factor > InventoryRules.MaxFactor)
                errors.Add($"units[{i}].factor", "Hệ số là số nguyên từ 2 đến 10.000");
            if (!string.IsNullOrWhiteSpace(unit.Barcode) && !BarcodePattern().IsMatch(unit.Barcode.Trim()))
                errors.Add($"units[{i}].barcode", "Mã vạch chỉ gồm chữ số, dài 8–14 ký tự");
            if (request.Units.Take(i).Any(o => string.Equals(o.Name?.Trim(), unit.Name?.Trim(), StringComparison.OrdinalIgnoreCase) || o.Factor == unit.Factor))
                errors.Add($"units[{i}].name", "Đơn vị bị trùng");
        }

        for (var i = 0; i < request.Levels.Count; i++)
        {
            var level = request.Levels[i];
            if (level.MinQty < 0)
                errors.Add($"levels[{i}].minQty", "Tồn tối thiểu là số nguyên không âm");
            if (level.MaxQty < 0)
                errors.Add($"levels[{i}].maxQty", "Tồn tối đa là số nguyên không âm");
            if (level is { MinQty: { } min, MaxQty: { } max } && min >= max)
                errors.Add($"levels[{i}].minQty", "Tồn tối thiểu phải nhỏ hơn tồn tối đa");
        }

        errors.ThrowIfAny();

        // 2. Tham chiếu (400).
        var group = await groups.QueryNoTracking().FirstOrDefaultAsync(g => g.Id == request.GroupId, ct);
        if (group is null || (!group.IsActive && (isNew || product.GroupId != group.Id)))
            errors.Add("groupId", "Chọn nhóm hàng đang sử dụng");
        var warehouseIds = await warehouses.QueryNoTracking().Select(w => w.Id).ToListAsync(ct);
        for (var i = 0; i < request.Levels.Count; i++)
        {
            if (!warehouseIds.Contains(request.Levels[i].WarehouseId))
                errors.Add($"levels[{i}].warehouseId", "Kho không tồn tại");
        }

        var usedUnitIds = isNew ? [] : await UsedUnitIdsAsync(product.Units.Select(u => u.Id).ToList(), ct);
        for (var i = 0; i < request.Units.Count; i++)
        {
            var input = request.Units[i];
            if (input.Id is not { } unitId)
                continue;
            var current = product.Units.FirstOrDefault(u => u.Id == unitId);
            if (current is null)
                errors.Add($"units[{i}].name", "Đơn vị không thuộc mặt hàng");
            else if (current.Factor != input.Factor && usedUnitIds.Contains(unitId))
                throw UnitUsed(i);
        }

        if (product.Units.Any(u => request.Units.All(i => i.Id != u.Id) && usedUnitIds.Contains(u.Id)))
        {
            throw InventoryErrors.WithErrors(InventoryErrors.DonViDaDung, InventoryErrors.UnitUsedMessage,
                new Dictionary<string, string[]> { ["units"] = [InventoryErrors.UnitUsedMessage] });
        }

        errors.ThrowIfAny();

        // 3. Trùng (409).
        if (await products.AnyAsync(p => p.Code == code && p.Id != product.Id, ct))
        {
            var other = await products.QueryNoTracking().Where(p => p.Code == code).Select(p => p.Name).FirstAsync(ct);
            throw new ConflictException($"Mã hàng đã dùng cho {other}", "code");
        }

        var barcodes = new List<(string Field, string Code)>();
        if (barcode is not null)
            barcodes.Add(("barcode", barcode));
        for (var i = 0; i < request.Units.Count; i++)
        {
            if (!string.IsNullOrWhiteSpace(request.Units[i].Barcode))
                barcodes.Add(($"units[{i}].barcode", request.Units[i].Barcode!.Trim()));
        }

        for (var i = 0; i < barcodes.Count; i++)
        {
            var (field, value) = barcodes[i];
            if (barcodes.Take(i).Any(b => b.Code == value))
            {
                throw InventoryProblems.Coded(InventoryErrors.MaVachTrung,
                    InventoryErrors.BarcodeUsed(request.Name!.Trim(), field == "barcode" ? request.BaseUnit!.Trim() : "đơn vị khác"), field);
            }

            var owner = await products.QueryNoTracking().Where(p => p.Id != product.Id && p.Barcode == value)
                .Select(p => new { p.Name, Unit = p.BaseUnit }).FirstOrDefaultAsync(ct)
                ?? await units.QueryNoTracking().Where(u => u.ProductId != product.Id && u.Barcode == value)
                    .Join(products.QueryNoTracking(), u => u.ProductId, p => p.Id, (u, p) => new { p.Name, Unit = u.Name })
                    .FirstOrDefaultAsync(ct);
            if (owner is not null)
                throw InventoryProblems.Coded(InventoryErrors.MaVachTrung, InventoryErrors.BarcodeUsed(owner.Name, owner.Unit), field);
        }

        // 4. Ghi.
        product.Code = code;
        product.Name = request.Name!.Trim();
        product.GroupId = request.GroupId;
        product.BaseUnit = request.BaseUnit!.Trim();
        product.Barcode = barcode;
        product.Spec = DocumentSupport.Limit(request.Spec, 100);

        var keep = request.Units.Where(u => u.Id is not null).Select(u => u.Id!.Value).ToHashSet();
        foreach (var removed in product.Units.Where(u => !keep.Contains(u.Id)).ToList())
        {
            product.Units.Remove(removed);
            units.Delete(removed);
        }

        foreach (var input in request.Units)
        {
            var unit = input.Id is { } unitId ? product.Units.First(u => u.Id == unitId) : null;
            if (unit is null)
            {
                unit = new ProductUnit { ProductId = product.Id };
                product.Units.Add(unit);
            }

            unit.Name = input.Name!.Trim();
            unit.Factor = input.Factor;
            unit.Barcode = string.IsNullOrWhiteSpace(input.Barcode) ? null : input.Barcode.Trim();
        }

        var order = 1;
        foreach (var unit in product.Units.OrderBy(u => u.Factor))
            unit.SortOrder = order++;
        product.RefreshSearchText();

        if (isNew)
            await products.AddAsync(product, ct);

        var existingLevels = await levels.Query().Where(l => l.ProductId == product.Id).ToListAsync(ct);
        foreach (var input in request.Levels)
        {
            var level = existingLevels.FirstOrDefault(l => l.WarehouseId == input.WarehouseId);
            if (level is null)
            {
                if (input.MinQty is null && input.MaxQty is null)
                    continue;
                level = new StockLevel { WarehouseId = input.WarehouseId, ProductId = product.Id };
                await levels.AddAsync(level, ct);
            }

            level.MinQty = input.MinQty;
            level.MaxQty = input.MaxQty;
        }

        await unitOfWork.SaveChangesAsync(ct);
    }

    private static Domain.Common.DomainException UnitUsed(int index) =>
        InventoryErrors.WithErrors(InventoryErrors.DonViDaDung, InventoryErrors.UnitUsedMessage,
            new Dictionary<string, string[]> { [$"units[{index}].factor"] = [InventoryErrors.UnitUsedMessage] });

    private async Task<HashSet<Guid>> UsedUnitIdsAsync(List<Guid> unitIds, CancellationToken ct)
    {
        if (unitIds.Count == 0)
            return [];
        var used = new HashSet<Guid>();
        used.UnionWith(await receiptLines.QueryNoTracking().Where(l => l.UnitId != null && unitIds.Contains(l.UnitId.Value)).Select(l => l.UnitId!.Value).Distinct().ToListAsync(ct));
        used.UnionWith(await issueLines.QueryNoTracking().Where(l => l.UnitId != null && unitIds.Contains(l.UnitId.Value)).Select(l => l.UnitId!.Value).Distinct().ToListAsync(ct));
        used.UnionWith(await transferLines.QueryNoTracking().Where(l => l.UnitId != null && unitIds.Contains(l.UnitId.Value)).Select(l => l.UnitId!.Value).Distinct().ToListAsync(ct));
        return used;
    }

    private async Task<bool> HasDocumentsAsync(Guid id, CancellationToken ct) =>
        await receiptLines.AnyAsync(l => l.ProductId == id, ct)
        || await issueLines.AnyAsync(l => l.ProductId == id, ct)
        || await transferLines.AnyAsync(l => l.ProductId == id, ct)
        || await stocktakeLines.AnyAsync(l => l.ProductId == id, ct)
        || await ledger.AnyAsync(l => l.ProductId == id, ct);

    private sealed record ProductContext(
        InventoryActor Actor,
        List<WarehouseOption> Warehouses,
        List<StockLevel> Levels,
        Dictionary<(Guid, Guid), int> Reserved,
        HashSet<Guid> UsedUnits,
        HashSet<Guid> WithDocuments);

    private async Task<ProductContext> LoadContextAsync(List<Guid> ids, InventoryActor actor, CancellationToken ct)
    {
        var scoped = (await scope.GetWarehousesAsync(ct)).ToList();
        var scopedIds = scoped.Select(w => w.Id).ToList();
        var levelRows = await levels.QueryNoTracking().Where(l => ids.Contains(l.ProductId) && scopedIds.Contains(l.WarehouseId)).ToListAsync(ct);
        var unitIds = await units.QueryNoTracking().Where(u => ids.Contains(u.ProductId)).Select(u => u.Id).ToListAsync(ct);
        var withDocs = new HashSet<Guid>();
        withDocs.UnionWith(await receiptLines.QueryNoTracking().Where(l => ids.Contains(l.ProductId)).Select(l => l.ProductId).Distinct().ToListAsync(ct));
        withDocs.UnionWith(await issueLines.QueryNoTracking().Where(l => ids.Contains(l.ProductId)).Select(l => l.ProductId).Distinct().ToListAsync(ct));
        withDocs.UnionWith(await transferLines.QueryNoTracking().Where(l => ids.Contains(l.ProductId)).Select(l => l.ProductId).Distinct().ToListAsync(ct));
        withDocs.UnionWith(await stocktakeLines.QueryNoTracking().Where(l => ids.Contains(l.ProductId)).Select(l => l.ProductId).Distinct().ToListAsync(ct));
        return new ProductContext(actor, scoped, levelRows, await stockQueries.ReservedAllAsync(ct), await UsedUnitIdsAsync(unitIds, ct), withDocs);
    }

    private static ProductDetailDto ToDetail(Product p, ProductContext context, bool withLevels)
    {
        // Mọi kho đang hoạt động trong phạm vi, cộng kho đã ngừng nhưng còn tồn.
        var cells = context.Warehouses
            .Select(w => (Warehouse: w, Level: context.Levels.FirstOrDefault(l => l.ProductId == p.Id && l.WarehouseId == w.Id)))
            .Where(x => x.Warehouse.IsActive || (x.Level?.OnHand ?? 0) > 0)
            .Select(x =>
            {
                var onHand = x.Level?.OnHand ?? 0;
                var available = onHand - context.Reserved.GetValueOrDefault((x.Warehouse.Id, p.Id));
                return new ProductStockCell(x.Warehouse.Id, x.Warehouse.Code, onHand,
                    StockMath.Status(onHand, available, x.Level?.MinQty, x.Level?.MaxQty));
            })
            .ToList();
        return new ProductDetailDto
        {
            Id = p.Id,
            Code = p.Code,
            Name = p.Name,
            GroupId = p.GroupId,
            GroupName = p.Group?.Name ?? string.Empty,
            GroupColor = p.Group?.Color ?? string.Empty,
            BaseUnit = p.BaseUnit,
            Barcode = p.Barcode,
            Spec = p.Spec,
            ImageUrl = p.ImageUrl,
            IsActive = p.IsActive,
            Units = p.Units.OrderBy(u => u.SortOrder)
                .Select(u => new ProductUnitDto(u.Id, u.Name, u.Factor, u.Barcode, u.SortOrder, context.UsedUnits.Contains(u.Id))).ToList(),
            Stocks = cells,
            TotalOnHand = cells.Sum(c => c.OnHand),
            HasDocuments = context.WithDocuments.Contains(p.Id),
            Levels = withLevels
                ? context.Warehouses.Where(w => w.IsActive).Select(w =>
                {
                    var level = context.Levels.FirstOrDefault(l => l.ProductId == p.Id && l.WarehouseId == w.Id);
                    return new ProductLevelDto(w.Id, w.Code, w.Name, level?.MinQty, level?.MaxQty, level?.OnHand ?? 0);
                }).ToList()
                : []
        };
    }

    private static CatalogProduct ToCatalog(Product p) => new()
    {
        Id = p.Id,
        Code = p.Code,
        Name = p.Name,
        GroupId = p.GroupId,
        BaseUnit = p.BaseUnit,
        Barcode = p.Barcode,
        Spec = p.Spec,
        ImageUrl = p.ImageUrl,
        IsActive = p.IsActive,
        Units = p.Units.OrderBy(u => u.SortOrder).Select(u => new CatalogUnit(u.Id, u.Name, u.Factor, u.Barcode)).ToList()
    };

    [GeneratedRegex(@"^[A-Z0-9-]{3,20}$")]
    private static partial Regex ProductCodePattern();

    [GeneratedRegex(@"^\d{8,14}$")]
    private static partial Regex BarcodePattern();
}
