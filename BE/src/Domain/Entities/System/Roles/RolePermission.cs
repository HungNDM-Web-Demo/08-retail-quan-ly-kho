using Domain.Entities.System.Permissions;

namespace Domain.Entities.System.Roles;

/// <summary>Bảng nối vai trò – quyền (<c>System_RolePermissions</c>), khóa chính (RoleId, PermissionId).</summary>
public class RolePermission
{
    private RolePermission()
    {
    }

    public RolePermission(Guid roleId, Guid permissionId)
    {
        RoleId = roleId;
        PermissionId = permissionId;
    }

    public Guid RoleId { get; private set; }
    public Guid PermissionId { get; private set; }

    public Role Role { get; private set; } = null!;
    public Permission Permission { get; private set; } = null!;
}
