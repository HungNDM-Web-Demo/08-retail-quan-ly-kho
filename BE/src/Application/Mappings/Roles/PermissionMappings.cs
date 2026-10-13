using Application.DTOs.Roles;
using Domain.Entities.System.Permissions;

namespace Application.Mappings.Roles;

/// <summary>Ánh xạ viết tay cho danh mục quyền.</summary>
public static class PermissionMappings
{
    public static PermissionItem ToDto(this Permission permission) => new()
    {
        Code = permission.Code,
        Name = permission.Name,
        SortOrder = permission.SortOrder
    };
}
