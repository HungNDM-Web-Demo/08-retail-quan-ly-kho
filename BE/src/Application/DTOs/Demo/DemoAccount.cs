namespace Application.DTOs.Demo;

/// <summary>Tài khoản demo cho nút "Đăng nhập nhanh" trên trang đăng nhập.</summary>
public sealed record DemoAccount
{
    public string Username { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string RoleCode { get; init; } = string.Empty;
    public string RoleName { get; init; } = string.Empty;

    /// <summary>Vai trò này dùng để xem gì.</summary>
    public string Description { get; init; } = string.Empty;
}
