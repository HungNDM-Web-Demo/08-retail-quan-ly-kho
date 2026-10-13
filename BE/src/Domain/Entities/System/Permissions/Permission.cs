using Domain.Base;

namespace Domain.Entities.System.Permissions;

/// <summary>Danh mục quyền (<c>System_Permissions</c>). Chỉ tạo bằng seed, không sửa qua giao diện.</summary>
public class Permission : BaseEntity
{
    public const int CodeMaxLength = 100;
    public const int GroupNameMaxLength = 100;
    public const int NameMaxLength = 150;

    private Permission()
    {
    }

    /// <summary>Mã dạng <c>{resource}.{action}</c>, vd <c>orders.cancel</c>.</summary>
    public string Code { get; private set; } = string.Empty;
    public string GroupName { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }

    public static Permission Create(string code, string groupName, string name, int sortOrder)
    {
        var permission = new Permission { Code = code.Trim().ToLowerInvariant() };
        permission.UpdateMetadata(groupName, name, sortOrder);
        return permission;
    }

    public void UpdateMetadata(string groupName, string name, int sortOrder)
    {
        GroupName = groupName.Trim();
        Name = name.Trim();
        SortOrder = sortOrder;
    }
}
