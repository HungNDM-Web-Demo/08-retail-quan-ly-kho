namespace Application.DTOs.Auth;

/// <summary>Người dùng tự đổi mật khẩu.</summary>
public sealed record ChangePasswordRequest
{
    public string CurrentPassword { get; init; } = string.Empty;

    /// <summary>Tối thiểu 8 ký tự, có chữ và số (BR-SYS-02).</summary>
    public string NewPassword { get; init; } = string.Empty;
}
