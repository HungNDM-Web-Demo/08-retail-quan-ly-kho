using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Options;

/// <summary>Cấu hình JWT, nạp từ <c>JWT_KEY</c>, <c>JWT_ISSUER</c>, <c>JWT_AUDIENCE</c>, <c>JWT_ACCESS_MINUTES</c>, <c>JWT_REFRESH_DAYS</c>.</summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>HMAC-SHA256 cần khóa tối thiểu 32 byte.</summary>
    public const int MinKeyBytes = 32;

    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;

    /// <summary>BR-SYS-08: access token 60 phút.</summary>
    public int AccessMinutes { get; set; } = 60;

    /// <summary>BR-SYS-08: refresh token 7 ngày.</summary>
    public int RefreshDays { get; set; } = 7;

    public bool HasValidKey() => Encoding.UTF8.GetByteCount(Key ?? string.Empty) >= MinKeyBytes;

    public SymmetricSecurityKey CreateSigningKey() => new(Encoding.UTF8.GetBytes(Key));
}
