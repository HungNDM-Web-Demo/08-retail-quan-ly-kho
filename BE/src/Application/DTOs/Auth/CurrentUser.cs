namespace Application.DTOs.Auth;

/// <summary>Thông tin tài khoản đang đăng nhập, kèm vai trò và quyền mới nhất.</summary>
public sealed record CurrentUser
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? AvatarUrl { get; init; }

    /// <summary>Mã vai trò, vd <c>["MANAGER"]</c>.</summary>
    public IReadOnlyList<string> Roles { get; init; } = [];

    /// <summary>Tên hiển thị của vai trò, cùng thứ tự với <see cref="Roles"/>, vd <c>["Quản lý"]</c>.</summary>
    public IReadOnlyList<string> RoleNames { get; init; } = [];

    /// <summary>Mã quyền; vai trò ADMIN nhận toàn bộ.</summary>
    public IReadOnlyList<string> Permissions { get; init; } = [];

    /// <summary>true khi có vai trò ADMIN.</summary>
    public bool IsSuperAdmin { get; init; }

    public bool IsDemoAccount { get; init; }
}
