namespace Infrastructure.Persistence.Seeders;

// Dữ liệu nền đã ghép, dùng cho SystemSeeder và API demo.

public sealed record PermissionSeed(string Code, string GroupName, string Name, int SortOrder);

/// <param name="Permissions">Mã quyền đã mở rộng "*" và cộng roleGrants, theo thứ tự danh mục quyền.</param>
public sealed record RoleSeed(string Code, string Name, string? Description, bool IsSystem, IReadOnlyList<string> Permissions);

/// <param name="QuickLogin">Hiện ở nút "Đăng nhập nhanh" và dùng được cho <c>/api/demo/login-as</c>.</param>
/// <param name="Description">Vai trò này dùng để xem gì, trả ở <c>GET /api/demo/accounts</c>.</param>
public sealed record UserSeed(
    string Username,
    string FullName,
    string? Email,
    string? Phone,
    IReadOnlyList<string> Roles,
    bool IsDemoAccount,
    bool QuickLogin,
    int SortOrder,
    string Description);

public sealed record SettingSeed(string Key, string Value, string GroupName);
