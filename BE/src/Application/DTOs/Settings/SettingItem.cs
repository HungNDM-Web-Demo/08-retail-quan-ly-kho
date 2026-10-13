namespace Application.DTOs.Settings;

/// <summary>Một khóa cài đặt.</summary>
public sealed record SettingItem
{
    /// <summary>Khóa dạng <c>Nhóm.Tên</c>, vd <c>Brand.AppName</c>.</summary>
    public string Key { get; init; } = string.Empty;

    public string Value { get; init; } = string.Empty;
    public string GroupName { get; init; } = string.Empty;
}
