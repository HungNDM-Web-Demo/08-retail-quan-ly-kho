namespace Application.DTOs.Auth;

/// <summary>Đổi refresh token lấy cặp token mới.</summary>
public sealed record RefreshRequest
{
    public string RefreshToken { get; init; } = string.Empty;
}
