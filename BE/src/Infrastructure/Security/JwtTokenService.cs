using System.Security.Cryptography;
using System.Text;
using Application.Common.Models;
using Application.Interfaces.Services.Auth;
using Domain.Entities.System.Users;
using Infrastructure.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Security;

/// <summary>Tạo access token JWT (HMAC-SHA256) và refresh token ngẫu nhiên.</summary>
public sealed class JwtTokenService(IOptions<JwtOptions> options, TimeProvider timeProvider) : IJwtTokenService
{
    private const int RefreshTokenBytes = 64;

    private readonly JwtOptions _options = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public TimeSpan RefreshTokenLifetime => TimeSpan.FromDays(_options.RefreshDays);

    public AccessTokenResult CreateAccessToken(User user, UserAccess access, Guid sessionId)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var expiresAt = now.AddMinutes(_options.AccessMinutes);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(_options.CreateSigningKey(), SecurityAlgorithms.HmacSha256),
            Claims = new Dictionary<string, object>
            {
                [AppClaimTypes.Subject] = user.Id.ToString(),
                [AppClaimTypes.TokenId] = Guid.NewGuid().ToString(),
                [AppClaimTypes.Name] = user.Username,
                [AppClaimTypes.FullName] = user.FullName,
                [AppClaimTypes.Roles] = access.Roles.ToArray(),
                [AppClaimTypes.Permissions] = access.Permissions.ToArray(),
                [AppClaimTypes.IsSuperAdmin] = access.IsSuperAdmin ? "true" : "false",
                [AppClaimTypes.SessionId] = sessionId.ToString()
            }
        };

        return new AccessTokenResult(_handler.CreateToken(descriptor), expiresAt);
    }

    public string CreateRefreshToken() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(RefreshTokenBytes));

    public string HashRefreshToken(string refreshToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));
}
