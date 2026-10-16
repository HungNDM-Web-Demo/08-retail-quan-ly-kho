using System.Globalization;
using System.Text.RegularExpressions;
using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Inventory;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Inventory;
using Domain.Entities.Inventory;
using Domain.Entities.Inventory.GoodsIssues;
using Domain.Entities.Inventory.GoodsReceipts;
using Domain.Entities.Inventory.Suppliers;
using Domain.Enums.Inventory;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>Nhà cung cấp (FR-08; 07 §2.2).</summary>
public sealed partial class SupplierService(
    IGenericRepository<Supplier> suppliers,
    IGenericRepository<GoodsReceipt> receipts,
    IGenericRepository<GoodsIssue> issues,
    IUnitOfWork unitOfWork) : ISupplierService
{
    public async Task<PaginatedResult<SupplierDto>> GetPagedAsync(SupplierQuery query, CancellationToken ct = default)
    {
        var source = suppliers.QueryNoTracking();
        if (query.IsActive is { } active)
            source = source.Where(s => s.IsActive == active);
        if (query.GetSearchTerm() is { } term)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(s => AppDbFunctions.Matches(s.Code, pattern) || AppDbFunctions.Matches(s.Name, pattern)
                || AppDbFunctions.Matches(s.TaxCode, pattern) || AppDbFunctions.Matches(s.Phone, pattern));
        }

        if (string.IsNullOrWhiteSpace(query.SortBy))
        {
            query.SortBy = "code";
            query.SortDir ??= "asc";
        }

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var stats = await StatsAsync(page.Items.Select(s => s.Id).ToList(), ct);
        return page.Map(items => items.Select(s => ToDto(s, stats)).ToList());
    }

    public async Task<IReadOnlyList<SupplierOption>> GetOptionsAsync(CancellationToken ct = default) =>
        await suppliers.QueryNoTracking().OrderBy(s => s.Code)
            .Select(s => new SupplierOption(s.Id, s.Code, s.Name, s.IsActive)).ToListAsync(ct);

    public async Task<SupplierDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await suppliers.QueryNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy nhà cung cấp.");
        return ToDto(supplier, await StatsAsync([id], ct));
    }

    public async Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct = default)
    {
        Validate(request, isNew: true);
        var code = request.Code?.Trim();
        if (string.IsNullOrEmpty(code))
        {
            var codes = await suppliers.QueryNoTracking().IgnoreQueryFilters().Select(s => s.Code).ToListAsync(ct);
            var max = codes.Select(c => c.Length > 3 && int.TryParse(c[3..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
                .DefaultIfEmpty(0).Max();
            code = $"NCC{max + 1:D3}";
        }
        else if (await suppliers.AnyAsync(s => s.Code == code, ct))
        {
            throw new ConflictException("Mã nhà cung cấp đã tồn tại", "code");
        }

        var supplier = new Supplier { Code = code };
        Apply(supplier, request);
        await suppliers.AddAsync(supplier, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(supplier.Id, ct);
    }

    public async Task<SupplierDto> UpdateAsync(Guid id, SaveSupplierRequest request, CancellationToken ct = default)
    {
        Validate(request, isNew: false);
        var supplier = await suppliers.Query().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy nhà cung cấp.");
        var code = request.Code!.Trim();
        if (code != supplier.Code && await suppliers.AnyAsync(s => s.Code == code && s.Id != id, ct))
            throw new ConflictException("Mã nhà cung cấp đã tồn tại", "code");
        supplier.Code = code;
        Apply(supplier, request);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<SupplierDto> SetActiveAsync(Guid id, SetActiveRequest request, CancellationToken ct = default)
    {
        var supplier = await suppliers.Query().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy nhà cung cấp.");
        supplier.IsActive = request.IsActive;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await suppliers.Query().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy nhà cung cấp.");
        if (await receipts.AnyAsync(r => r.SupplierId == id, ct) || await issues.AnyAsync(i => i.SupplierId == id, ct))
            throw InventoryErrors.Business(InventoryErrors.DaCoChungTu, InventoryErrors.HasDocuments("Nhà cung cấp"));
        suppliers.Delete(supplier);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static void Validate(SaveSupplierRequest request, bool isNew)
    {
        var errors = new FieldErrorBag();
        var code = request.Code?.Trim();
        if ((!isNew || !string.IsNullOrEmpty(code)) && (code is null || !CodePattern().IsMatch(code)))
            errors.Add("code", "Mã nhà cung cấp dạng NCC001");
        if (string.IsNullOrWhiteSpace(request.Name))
            errors.Add("name", "Nhập tên nhà cung cấp");
        else if (request.Name.Trim().Length > 200)
            errors.Add("name", "Tên nhà cung cấp tối đa 200 ký tự");
        if (!string.IsNullOrWhiteSpace(request.TaxCode) && !TaxPattern().IsMatch(request.TaxCode.Trim()))
            errors.Add("taxCode", "Mã số thuế gồm 10 hoặc 13 chữ số");
        if (!string.IsNullOrWhiteSpace(request.Phone) && !DocumentSupport.IsPhone(request.Phone))
            errors.Add("phone", DocumentSupport.PhoneMessage);
        errors.ThrowIfAny();
    }

    private static void Apply(Supplier supplier, SaveSupplierRequest request)
    {
        supplier.Name = request.Name!.Trim();
        supplier.TaxCode = DocumentSupport.Limit(request.TaxCode, 14);
        supplier.Phone = DocumentSupport.Limit(request.Phone, 20);
        supplier.Address = DocumentSupport.Limit(request.Address, 250);
        supplier.ContactName = DocumentSupport.Limit(request.ContactName, 100);
    }

    private sealed record Stats(int ReceiptCount, DateTime? LastReceiptAt, bool HasDocuments);

    private async Task<Dictionary<Guid, Stats>> StatsAsync(List<Guid> ids, CancellationToken ct)
    {
        var approved = await receipts.QueryNoTracking()
            .Where(r => r.SupplierId != null && ids.Contains(r.SupplierId.Value) && r.Status == DocStatus.DaDuyet)
            .GroupBy(r => r.SupplierId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count(), Last = g.Max(r => r.ApprovedAt) })
            .ToDictionaryAsync(x => x.Id, ct);
        var withReceipts = await receipts.QueryNoTracking().Where(r => r.SupplierId != null && ids.Contains(r.SupplierId.Value))
            .Select(r => r.SupplierId!.Value).Distinct().ToListAsync(ct);
        var withIssues = await issues.QueryNoTracking().Where(r => r.SupplierId != null && ids.Contains(r.SupplierId.Value))
            .Select(r => r.SupplierId!.Value).Distinct().ToListAsync(ct);
        return ids.ToDictionary(id => id, id => new Stats(
            approved.GetValueOrDefault(id)?.Count ?? 0,
            approved.GetValueOrDefault(id)?.Last,
            withReceipts.Contains(id) || withIssues.Contains(id)));
    }

    private static SupplierDto ToDto(Supplier s, Dictionary<Guid, Stats> stats)
    {
        var stat = stats.GetValueOrDefault(s.Id) ?? new Stats(0, null, false);
        return new SupplierDto
        {
            Id = s.Id,
            Code = s.Code,
            Name = s.Name,
            TaxCode = s.TaxCode,
            Phone = s.Phone,
            Address = s.Address,
            ContactName = s.ContactName,
            IsActive = s.IsActive,
            ReceiptCount = stat.ReceiptCount,
            LastReceiptAt = stat.LastReceiptAt,
            HasDocuments = stat.HasDocuments
        };
    }

    [GeneratedRegex(@"^NCC\d{3}$")]
    private static partial Regex CodePattern();

    [GeneratedRegex(@"^\d{10}(-?\d{3})?$")]
    private static partial Regex TaxPattern();

}
