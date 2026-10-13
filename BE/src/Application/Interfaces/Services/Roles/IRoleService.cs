using Application.DTOs.Roles;

namespace Application.Interfaces.Services.Roles;

/// <summary>
/// Quản lý vai trò và phân quyền (UC-SYS-06). Danh sách vai trò ít nên trả cả mảng, không phân trang.
/// </summary>
public interface IRoleService
{
    /// <summary>Mọi vai trò (chưa xóa), vai trò seed trước, vai trò tạo sau xếp sau.</summary>
    Task<IReadOnlyList<RoleDto>> GetAllAsync(CancellationToken ct = default);

    Task<RoleDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<RoleDto> CreateAsync(CreateRoleRequest request, CancellationToken ct = default);

    /// <summary>Sửa tên, mô tả.</summary>
    Task<RoleDto> UpdateAsync(Guid id, UpdateRoleRequest request, CancellationToken ct = default);

    /// <summary>Thay toàn bộ quyền của vai trò; không sửa được quyền của ADMIN (BR-SYS-06).</summary>
    Task<RoleDto> UpdatePermissionsAsync(Guid id, UpdateRolePermissionsRequest request, CancellationToken ct = default);

    /// <summary>Xóa mềm; chặn vai trò hệ thống và vai trò đang gán cho tài khoản (BR-SYS-06, BR-SYS-07).</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
