using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Roles;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Roles;
using Application.Mappings.Roles;
using Domain.Entities.System.Permissions;
using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Roles;

public sealed class PermissionService(
    IGenericRepository<Permission> permissions,
    IGenericRepository<User> users) : IPermissionService
{
    // Service scoped: lưu tạm quyền trong phạm vi một request để nhiều bộ lọc quyền không truy vấn lặp lại.
    private readonly Dictionary<Guid, UserAccess> _accessCache = [];

    public async Task<IReadOnlyList<PermissionGroup>> GetGroupsAsync(CancellationToken ct = default)
    {
        var items = await permissions.QueryNoTracking()
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Code)
            .ToListAsync(ct);

        return items
            .GroupBy(p => p.GroupName)
            .Select(g => new PermissionGroup
            {
                GroupName = g.Key,
                Items = g.Select(p => p.ToDto()).ToList()
            })
            .ToList();
    }

    public async Task<UserAccess> GetUserAccessAsync(Guid userId, CancellationToken ct = default)
    {
        if (_accessCache.TryGetValue(userId, out var cached))
            return cached;

        var roleRows = await users.QueryNoTracking()
            .Where(u => u.Id == userId)
            .SelectMany(u => u.UserRoles.Select(ur => new { ur.Role.Code, ur.Role.Name }))
            .ToListAsync(ct);
        var roles = roleRows.OrderBy(r => r.Code, StringComparer.Ordinal).ToList();

        // BR-SYS-06: ADMIN luôn có toàn bộ quyền, không phụ thuộc bảng RolePermissions.
        var isSuperAdmin = roles.Any(r => string.Equals(r.Code, RoleCodes.Admin, StringComparison.OrdinalIgnoreCase));
        var permissionQuery = isSuperAdmin
            ? permissions.QueryNoTracking()
            : users.QueryNoTracking()
                .Where(u => u.Id == userId)
                .SelectMany(u => u.UserRoles)
                .SelectMany(ur => ur.Role.RolePermissions)
                .Select(rp => rp.Permission);

        var permissionRows = await permissionQuery
            .Select(p => new { p.Code, p.SortOrder })
            .Distinct()
            .ToListAsync(ct);
        var permissionCodes = permissionRows
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Code, StringComparer.Ordinal)
            .Select(p => p.Code)
            .ToList();

        var access = new UserAccess(
            roles.Select(r => r.Code).ToList(),
            roles.Select(r => r.Name).ToList(),
            permissionCodes,
            isSuperAdmin);
        _accessCache[userId] = access;
        return access;
    }

    public async Task<bool> HasPermissionAsync(Guid userId, string permission, CancellationToken ct = default) =>
        (await GetUserAccessAsync(userId, ct)).HasPermission(permission);
}
