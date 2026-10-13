using Domain.Base;

namespace Domain.Entities.System.Settings;

/// <summary>Cài đặt dạng khóa – giá trị (<c>System_Settings</c>), vd <c>Brand.AppName</c>.</summary>
public class Setting : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int KeyMaxLength = 100;
    public const int ValueMaxLength = 4000;
    public const int GroupNameMaxLength = 100;

    private Setting()
    {
    }

    public string Key { get; private set; } = string.Empty;
    public string Value { get; private set; } = string.Empty;
    public string GroupName { get; private set; } = string.Empty;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public static Setting Create(string key, string value, string groupName) =>
        new() { Key = key.Trim(), Value = value, GroupName = groupName.Trim() };

    public void SetValue(string value) => Value = value;

    public void SetGroup(string groupName) => GroupName = groupName.Trim();
}
