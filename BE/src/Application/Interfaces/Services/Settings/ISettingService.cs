using Application.DTOs.Settings;

namespace Application.Interfaces.Services.Settings;

/// <summary>Cài đặt chung và thương hiệu (UC-SYS-07).</summary>
public interface ISettingService
{
    /// <summary>Khóa nhóm <c>Brand.*</c> và <c>Company.*</c>, dùng cho trang công khai.</summary>
    Task<IReadOnlyDictionary<string, string>> GetPublicAsync(CancellationToken ct = default);

    Task<IReadOnlyList<SettingItem>> GetAllAsync(CancellationToken ct = default);

    /// <summary>Cập nhật nhiều khóa; khóa chưa có thì báo lỗi.</summary>
    Task UpdateAsync(UpdateSettingsRequest request, CancellationToken ct = default);
}
