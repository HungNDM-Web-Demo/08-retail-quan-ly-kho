using Application.Common.Models;
using Domain.Entities.System.Users;

namespace Application.Interfaces.Services.Auth;

/// <summary>Tạo access token JWT và refresh token.</summary>
public interface IJwtTokenService
{
    /// <summary>Thời hạn refresh token (<c>JWT_REFRESH_DAYS</c>).</summary>
    TimeSpan RefreshTokenLifetime { get; }

    /// <summary>Tạo access token chứa claims theo KIEN-TRUC-HE-THONG §7.1, kèm <c>sid</c> là mã phiên.</summary>
    AccessTokenResult CreateAccessToken(User user, UserAccess access, Guid sessionId);

    /// <summary>Sinh refresh token ngẫu nhiên (trả cho client, không lưu DB).</summary>
    string CreateRefreshToken();

    /// <summary>Băm refresh token để lưu và tra cứu.</summary>
    string HashRefreshToken(string refreshToken);
}
