using Application.Common.Models;
using Application.DTOs.Auth;
using Application.DTOs.Users;
using Application.Mappings.Roles;
using Domain.Entities.System.Users;

namespace Application.Mappings.Users;

/// <summary>Ánh xạ viết tay cho tài khoản.</summary>
public static class UserMappings
{
    /// <summary>Cần <c>Include(u => u.UserRoles).ThenInclude(ur => ur.Role)</c> khi truy vấn để có danh sách vai trò.</summary>
    public static UserDto ToDto(this User user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        FullName = user.FullName,
        Email = user.Email,
        Phone = user.Phone,
        AvatarUrl = user.AvatarUrl,
        IsActive = user.IsActive,
        IsDemoAccount = user.IsDemoAccount,
        LastLoginAt = user.LastLoginAt,
        CreatedAt = user.CreatedAt,
        Roles = user.UserRoles
            .Select(ur => ur.Role.ToSummaryDto())
            .OrderBy(r => r.Name, StringComparer.Ordinal)
            .ToList()
    };

    /// <summary>Thông tin tài khoản đang đăng nhập; vai trò và quyền lấy từ <paramref name="access"/> (đọc mới từ DB).</summary>
    public static CurrentUser ToCurrentUser(this User user, UserAccess access) => new()
    {
        Id = user.Id,
        Username = user.Username,
        FullName = user.FullName,
        Email = user.Email,
        Phone = user.Phone,
        AvatarUrl = user.AvatarUrl,
        Roles = access.Roles,
        RoleNames = access.RoleNames,
        Permissions = access.Permissions,
        IsSuperAdmin = access.IsSuperAdmin,
        IsDemoAccount = user.IsDemoAccount
    };
}
