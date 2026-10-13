namespace Application.DTOs.Auth;

/// <summary>Đăng xuất: thu hồi refresh token của phiên hiện tại.</summary>
public sealed record LogoutRequest
{
    public string RefreshToken { get; init; } = string.Empty;
}
