using Application.DTOs.Settings;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Settings;
using Application.Mappings.Settings;
using Domain.Entities.System.Settings;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Settings;

public sealed class SettingService(
    IGenericRepository<Setting> settings,
    IUnitOfWork unitOfWork) : ISettingService
{
    // Nhóm khóa được trả ở API công khai (QUY-UOC-API §4.5).
    private const string BrandPrefix = "Brand.";
    private const string CompanyPrefix = "Company.";

    public async Task<IReadOnlyDictionary<string, string>> GetPublicAsync(CancellationToken ct = default)
    {
        var items = await settings.QueryNoTracking()
            .Where(s => s.Key.StartsWith(BrandPrefix) || s.Key.StartsWith(CompanyPrefix))
            .OrderBy(s => s.Key)
            .Select(s => new { s.Key, s.Value })
            .ToListAsync(ct);

        return items.ToDictionary(s => s.Key, s => s.Value, StringComparer.Ordinal);
    }

    public async Task<IReadOnlyList<SettingItem>> GetAllAsync(CancellationToken ct = default)
    {
        var items = await settings.QueryNoTracking()
            .OrderBy(s => s.GroupName)
            .ThenBy(s => s.Key)
            .ToListAsync(ct);

        return items.Select(s => s.ToDto()).ToList();
    }

    public async Task UpdateAsync(UpdateSettingsRequest request, CancellationToken ct = default)
    {
        // Bảng cài đặt nhỏ: tải hết rồi so khóa không phân biệt hoa thường (giống nhau trên SQL Server và SQLite).
        var existing = (await settings.Query().ToListAsync(ct))
            .ToDictionary(s => s.Key, StringComparer.OrdinalIgnoreCase);

        var failures = new List<ValidationFailure>();
        for (var i = 0; i < request.Items.Count; i++)
        {
            var item = request.Items[i];
            if (existing.TryGetValue(item.Key.Trim(), out var setting))
                setting.SetValue(item.Value);
            else
                failures.Add(new ValidationFailure($"items[{i}].key", $"Khóa cài đặt {item.Key} không tồn tại."));
        }

        if (failures.Count > 0)
            throw new ValidationException(failures);

        await unitOfWork.SaveChangesAsync(ct);
    }
}
