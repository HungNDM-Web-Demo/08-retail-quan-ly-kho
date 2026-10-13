namespace Application.DTOs.Users;

/// <summary>Quản trị viên đặt lại mật khẩu cho tài khoản.</summary>
public sealed record ResetPasswordRequest
{
    /// <summary>Tối thiểu 8 ký tự, có chữ và số (BR-SYS-02).</summary>
    public string NewPassword { get; init; } = string.Empty;
}
