namespace Application.DTOs.Settings;

/// <summary>Giá trị mới của một khóa cài đặt.</summary>
public sealed record UpdateSettingItem
{
    public string Key { get; init; } = string.Empty;
    public string Value { get; init; } = string.Empty;
}
