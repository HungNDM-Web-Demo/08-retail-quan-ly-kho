using System.Text.Json;
using Application.DTOs.Auth;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Auth;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Application.Mappings.Users;
using Domain.Entities.System.AuditLogs;
using Domain.Entities.System.Users;
using Domain.Enums.System.AuditLogs;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Auth;

/// <summary>
/// Tạo và gia hạn phiên đăng nhập cho tài khoản đã xác thực. Dùng chung cho đăng nhập bằng mật khẩu và đăng nhập nhanh demo.
/// Mỗi phiên là một refresh token; mã phiên (claim <c>sid</c>) là Id của refresh token đó.
/// </summary>
public sealed class AuthSessionIssuer(
    IGenericRepository<UserRefreshToken> refreshTokens,
    IGenericRepository<AuditLog> auditLogs,
    IUnitOfWork unitOfWork,
    IJwtTokenService tokenService,
    IPermissionService permissionService,
    ICurrentUserService currentUser,
    TimeProvider timeProvider)
{
    /// <summary>Refresh token đã thu hồi được giữ lại thêm một ngày rồi mới dọn.</summary>
    private static readonly TimeSpan RevokedTokenRetention = TimeSpan.FromDays(1);

    /// <summary>Mở phiên mới, ghi nhật ký Login. <paramref name="method"/>: <c>password</c> hoặc <c>demo</c>.</summary>
    public async Task<AuthResponse> StartSessionAsync(User user, string method, CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        await RemoveStaleTokensAsync(user.Id, now, ct);

        var (session, rawToken) = CreateSession(user.Id, now);
        await refreshTokens.AddAsync(session, ct);
        await auditLogs.AddAsync(
            AuditLog.Create(
                AuditAction.Login,
                nameof(User),
                user.Id.ToString(),
                user.Id,
                user.Username,
                currentUser.IpAddress,
                newValues: JsonSerializer.Serialize(new { method })),
            ct);

        await unitOfWork.SaveChangesAsync(ct);
        return await BuildResponseAsync(user, session.Id, rawToken, ct);
    }

    /// <summary>
    /// Gia hạn: thu hồi <paramref name="current"/> và cấp refresh token mới.
    /// Hai request cùng dùng một token thì request sau gặp <see cref="DbUpdateConcurrencyException"/>.
    /// </summary>
    public async Task<AuthResponse> RotateSessionAsync(User user, UserRefreshToken current, CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        current.Revoke(now);

        var (session, rawToken) = CreateSession(user.Id, now);
        await refreshTokens.AddAsync(session, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await BuildResponseAsync(user, session.Id, rawToken, ct);
    }

    private (UserRefreshToken Session, string RawToken) CreateSession(Guid userId, DateTime now)
    {
        var rawToken = tokenService.CreateRefreshToken();
        var session = UserRefreshToken.Create(
            userId,
            tokenService.HashRefreshToken(rawToken),
            now.Add(tokenService.RefreshTokenLifetime));
        return (session, rawToken);
    }

    private async Task<AuthResponse> BuildResponseAsync(User user, Guid sessionId, string rawRefreshToken, CancellationToken ct)
    {
        var access = await permissionService.GetUserAccessAsync(user.Id, ct);
        var accessToken = tokenService.CreateAccessToken(user, access, sessionId);
        return new AuthResponse
        {
            AccessToken = accessToken.Token,
            RefreshToken = rawRefreshToken,
            ExpiresAt = accessToken.ExpiresAt,
            User = user.ToCurrentUser(access)
        };
    }

    /// <summary>Dọn refresh token đã hết hạn hoặc thu hồi quá một ngày của tài khoản, tránh bảng phình to.</summary>
    private async Task RemoveStaleTokensAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var revokedBefore = now - RevokedTokenRetention;
        var stale = await refreshTokens.Query()
            .Where(t => t.UserId == userId && (t.ExpiresAt <= now || t.RevokedAt < revokedBefore))
            .ToListAsync(ct);
        refreshTokens.DeleteRange(stale);
    }
}
