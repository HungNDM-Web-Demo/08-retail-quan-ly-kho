using Application.Common.Models;
using Application.DTOs.Roles;

namespace Application.Interfaces.Services.Roles;

/// <summary>Danh mục quyền và quyền hiệu lực của tài khoản.</summary>
public interface IPermissionService
{
    /// <summary>Danh mục quyền theo nhóm cho ma trận quyền.</summary>
    Task<IReadOnlyList<PermissionGroup>> GetGroupsAsync(CancellationToken ct = default);

    /// <summary>Vai trò và quyền hiện tại của tài khoản, đọc từ DB (lưu tạm trong phạm vi một request).</summary>
    Task<UserAccess> GetUserAccessAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Tài khoản có quyền này không; ADMIN luôn có (BR-SYS-06).</summary>
    Task<bool> HasPermissionAsync(Guid userId, string permission, CancellationToken ct = default);
}
