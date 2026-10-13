namespace Application.Validators.Auth;

internal static class RefreshTokenRules
{
    /// <summary>Refresh token là 64 byte ngẫu nhiên mã hóa Base64Url (86 ký tự); chặn chuỗi dài bất thường.</summary>
    public const int MaxLength = 200;
}
