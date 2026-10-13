using Application.DTOs.Settings;
using Domain.Entities.System.Settings;

namespace Application.Mappings.Settings;

/// <summary>Ánh xạ viết tay cho cài đặt.</summary>
public static class SettingMappings
{
    public static SettingItem ToDto(this Setting setting) => new()
    {
        Key = setting.Key,
        Value = setting.Value,
        GroupName = setting.GroupName
    };
}
