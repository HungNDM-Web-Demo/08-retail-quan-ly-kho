namespace Application.Common.Models;

/// <summary>Vai trò và quyền hiệu lực của một tài khoản, đọc mới từ DB.</summary>
/// <param name="Roles">Mã vai trò, vd <c>["MANAGER"]</c>.</param>
/// <param name="RoleNames">Tên hiển thị của vai trò, cùng thứ tự với <paramref name="Roles"/>.</param>
/// <param name="Permissions">Mã quyền; vai trò ADMIN nhận toàn bộ danh mục quyền.</param>
/// <param name="IsSuperAdmin">true khi có vai trò ADMIN (BR-SYS-06).</param>
public sealed record UserAccess(
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> RoleNames,
    IReadOnlyList<string> Permissions,
    bool IsSuperAdmin)
{
    public static UserAccess None { get; } = new([], [], [], false);

    public bool HasPermission(string permission) =>
        IsSuperAdmin || Permissions.Contains(permission, StringComparer.OrdinalIgnoreCase);
}
