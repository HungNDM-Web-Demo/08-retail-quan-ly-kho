namespace Application.DTOs.Auth;

/// <summary>Kết quả đăng nhập, gia hạn phiên, đăng nhập nhanh.</summary>
public sealed record AuthResponse
{
    /// <summary>JWT gửi kèm header <c>Authorization: Bearer</c>.</summary>
    public string AccessToken { get; init; } = string.Empty;

    /// <summary>Dùng một lần để lấy cặp token mới qua <c>POST /api/auth/refresh</c>.</summary>
    public string RefreshToken { get; init; } = string.Empty;

    /// <summary>Thời điểm (UTC) access token hết hạn.</summary>
    public DateTime ExpiresAt { get; init; }

    public CurrentUser User { get; init; } = new();
}
