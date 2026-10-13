namespace Application.DTOs.Auth;

/// <summary>Đăng nhập bằng tên đăng nhập và mật khẩu.</summary>
public sealed record LoginRequest
{
    /// <summary>Tên đăng nhập (không phân biệt hoa thường).</summary>
    public string Username { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;
}
