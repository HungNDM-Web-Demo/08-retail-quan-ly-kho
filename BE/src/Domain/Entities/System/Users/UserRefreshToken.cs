using Domain.Base;

namespace Domain.Entities.System.Users;

/// <summary>
/// Refresh token của một phiên đăng nhập (<c>System_UserRefreshTokens</c>). Chỉ lưu hash, không lưu token gốc.
/// Mỗi token dùng một lần: gia hạn xong thì thu hồi và cấp token mới.
/// </summary>
public class UserRefreshToken : BaseEntity
{
    public const int TokenHashMaxLength = 128;

    private UserRefreshToken()
    {
    }

    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }

    public User User { get; private set; } = null!;

    public static UserRefreshToken Create(Guid userId, string tokenHash, DateTime expiresAtUtc) =>
        new() { UserId = userId, TokenHash = tokenHash, ExpiresAt = expiresAtUtc };

    public bool IsActive(DateTime nowUtc) => RevokedAt is null && ExpiresAt > nowUtc;

    public void Revoke(DateTime nowUtc) => RevokedAt ??= nowUtc;
}
