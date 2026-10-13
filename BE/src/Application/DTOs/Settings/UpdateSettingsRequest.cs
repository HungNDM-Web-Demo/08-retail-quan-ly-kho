namespace Application.DTOs.Settings;

/// <summary>Cập nhật nhiều khóa cài đặt một lần. Chỉ sửa được khóa đã có.</summary>
public sealed record UpdateSettingsRequest
{
    public IReadOnlyList<UpdateSettingItem> Items { get; init; } = [];
}
