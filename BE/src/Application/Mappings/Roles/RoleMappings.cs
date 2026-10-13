using Application.DTOs.Roles;
using Application.DTOs.Users;
using Domain.Entities.System.Roles;

namespace Application.Mappings.Roles;

/// <summary>Ánh xạ viết tay cho vai trò.</summary>
public static class RoleMappings
{
    /// <summary>
    /// Cần <c>Include(r => r.UserRoles)</c> và <c>Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)</c>.
    /// Số tài khoản chỉ tính tài khoản chưa xóa (query filter của UserRole).
    /// </summary>
    public static RoleDto ToDto(this Role role) => new()
    {
        Id = role.Id,
        Code = role.Code,
        Name = role.Name,
        Description = role.Description,
        IsSystem = role.IsSystem,
        UserCount = role.UserRoles.Count,
        Permissions = role.RolePermissions
            .Select(rp => rp.Permission.Code)
            .Order(StringComparer.Ordinal)
            .ToList()
    };

    /// <summary>Vai trò rút gọn gắn với tài khoản.</summary>
    public static RoleSummaryDto ToSummaryDto(this Role role) => new()
    {
        Id = role.Id,
        Code = role.Code,
        Name = role.Name
    };
}
