using Application.Common.Exceptions;
using Application.Constants;
using Application.DTOs.Roles;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Roles;
using Application.Mappings.Roles;
using Domain.Common;
using Domain.Entities.System.Permissions;
using Domain.Entities.System.Roles;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Roles;

public sealed class RoleService(
    IGenericRepository<Role> roles,
    IGenericRepository<Permission> permissions,
    IUnitOfWork unitOfWork) : IRoleService
{
    private const string NotFoundMessage = "Không tìm thấy vai trò.";

    private List<string>? _allPermissionCodes;

    public async Task<IReadOnlyList<RoleDto>> GetAllAsync(CancellationToken ct = default)
    {
        var items = await QueryWithDetails(roles.QueryNoTracking())
            .OrderBy(r => r.CreatedAt)
            .ThenBy(r => r.Code)
            .ToListAsync(ct);

        var result = new List<RoleDto>(items.Count);
        foreach (var role in items)
            result.Add(await ToDtoAsync(role, ct));
        return result;
    }

    public async Task<RoleDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var role = await QueryWithDetails(roles.QueryNoTracking()).FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);

        return await ToDtoAsync(role, ct);
    }

    public async Task<RoleDto> CreateAsync(CreateRoleRequest request, CancellationToken ct = default)
    {
        var code = Role.NormalizeCode(request.Code);
        if (await roles.AnyAsync(r => r.Code == code, ct))
            throw new ConflictException($"Mã vai trò {code} đã tồn tại.", "code");

        var permissionIds = await ResolvePermissionIdsAsync(request.Permissions, ct);
        var role = Role.Create(code, request.Name, request.Description);
        role.SetPermissions(permissionIds);

        await roles.AddAsync(role, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(role.Id, ct);
    }

    public async Task<RoleDto> UpdateAsync(Guid id, UpdateRoleRequest request, CancellationToken ct = default)
    {
        var role = await roles.GetByIdAsync(id, ct) ?? throw new NotFoundException(NotFoundMessage);
        role.Update(request.Name, request.Description);

        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<RoleDto> UpdatePermissionsAsync(Guid id, UpdateRolePermissionsRequest request, CancellationToken ct = default)
    {
        var role = await roles.Query()
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);

        // BR-SYS-06: ADMIN luôn có toàn bộ quyền.
        if (IsAdmin(role))
            throw new DomainException("Vai trò Quản trị viên luôn có toàn bộ quyền, không cần phân quyền.");

        role.SetPermissions(await ResolvePermissionIdsAsync(request.Permissions, ct));

        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var role = await roles.GetByIdAsync(id, ct) ?? throw new NotFoundException(NotFoundMessage);
        var assignedUserCount = await roles.QueryNoTracking()
            .Where(r => r.Id == id)
            .Select(r => r.UserRoles.Count)
            .FirstAsync(ct);

        role.EnsureCanBeDeleted(assignedUserCount);

        // Role có ISoftDelete: interceptor đổi thành xóa mềm, giữ lại bảng phân quyền để tra nhật ký.
        roles.Delete(role);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static IQueryable<Role> QueryWithDetails(IQueryable<Role> source) =>
        source
            .Include(r => r.UserRoles)
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .AsSplitQuery();

    private static bool IsAdmin(Role role) => string.Equals(role.Code, RoleCodes.Admin, StringComparison.OrdinalIgnoreCase);

    private async Task<RoleDto> ToDtoAsync(Role role, CancellationToken ct)
    {
        var dto = role.ToDto();
        if (!IsAdmin(role))
            return dto;

        // BR-SYS-06: hiển thị ADMIN với đủ quyền kể cả quyền mới thêm chưa kịp seed lại.
        _allPermissionCodes ??= await permissions.QueryNoTracking()
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Code)
            .Select(p => p.Code)
            .ToListAsync(ct);
        return dto with { Permissions = _allPermissionCodes };
    }

    /// <summary>Đổi mã quyền sang Id; mã không có trong danh mục thì báo lỗi cho trường <c>permissions</c>.</summary>
    private async Task<List<Guid>> ResolvePermissionIdsAsync(IReadOnlyList<string> codes, CancellationToken ct)
    {
        var requested = codes.Select(c => c.Trim().ToLowerInvariant()).Distinct().ToList();

        // Tải entity (có theo dõi) để nhật ký ghi được mã quyền thay vì Id.
        var found = await permissions.Query()
            .Where(p => requested.Contains(p.Code))
            .ToListAsync(ct);

        var unknown = requested.Except(found.Select(p => p.Code), StringComparer.OrdinalIgnoreCase).ToList();
        if (unknown.Count > 0)
        {
            throw new ValidationException(
                [new ValidationFailure(nameof(CreateRoleRequest.Permissions), $"Mã quyền không tồn tại: {string.Join(", ", unknown)}.")]);
        }

        return found.Select(p => p.Id).ToList();
    }
}
