using Application.DTOs.Auth;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Auth;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Application.Mappings.Users;
using Domain.Common;
using Domain.Entities.System.Users;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Auth;

public sealed class AuthService(
    IGenericRepository<User> users,
    IGenericRepository<UserRefreshToken> refreshTokens,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    IJwtTokenService tokenService,
    IPermissionService permissionService,
    ICurrentUserService currentUser,
    AuthSessionIssuer sessionIssuer,
    TimeProvider timeProvider) : IAuthService
{
    // Câu thông báo đã thống nhất với FE (UC-SYS-01 E1–E3).
    public const string InvalidCredentialsMessage = "Tên đăng nhập hoặc mật khẩu không đúng";
    public const string AccountLockedMessage = "Tài khoản đã bị khóa, liên hệ quản trị viên";
    public const string SessionExpiredMessage = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.";

    // Băm giả để thời gian phản hồi khi sai tên đăng nhập giống khi sai mật khẩu (không lộ tài khoản nào tồn tại).
    private static string? _dummyPasswordHash;

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var username = User.NormalizeUsername(request.Username);
        var user = await users.Query().FirstOrDefaultAsync(u => u.Username == username, ct);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        if (user is null)
        {
            _dummyPasswordHash ??= passwordHasher.Hash(Guid.NewGuid().ToString());
            passwordHasher.Verify(request.Password, _dummyPasswordHash);
            throw new UnauthorizedAccessException(InvalidCredentialsMessage);
        }

        // BR-SYS-03: đang tạm khóa thì không kiểm tra mật khẩu. Tạm khóa và tài khoản bị khóa trả 400,
        // sai thông tin đăng nhập trả 401 (đã thống nhất với FE).
        if (user.IsLockedOut(now))
            throw new DomainException(LockedOutMessage(user, now));

        if (!passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            user.RegisterFailedLogin(now);
            await unitOfWork.SaveChangesAsync(ct);
            if (user.IsLockedOut(now))
                throw new DomainException(LockedOutMessage(user, now));
            throw new UnauthorizedAccessException(InvalidCredentialsMessage);
        }

        // BR-SYS-04: kiểm tra sau mật khẩu để không lộ trạng thái tài khoản cho người không biết mật khẩu.
        if (!user.IsActive)
            throw new DomainException(AccountLockedMessage);

        user.RegisterSuccessfulLogin(now);
        return await sessionIssuer.StartSessionAsync(user, "password", ct);
    }

    public async Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        var tokenHash = tokenService.HashRefreshToken(request.RefreshToken);
        var session = await refreshTokens.Query()
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        if (session is null || !session.IsActive(now))
            throw new UnauthorizedAccessException(SessionExpiredMessage);

        // BR-SYS-04: tài khoản bị khóa thì phiên bị thu hồi ở lần gia hạn này.
        if (!session.User.IsActive)
        {
            session.Revoke(now);
            await SaveIgnoringConcurrencyAsync(ct);
            throw new UnauthorizedAccessException(AccountLockedMessage);
        }

        try
        {
            return await sessionIssuer.RotateSessionAsync(session.User, session, ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Token vừa được dùng ở request khác: mỗi refresh token chỉ dùng một lần.
            throw new UnauthorizedAccessException(SessionExpiredMessage);
        }
    }

    public async Task LogoutAsync(LogoutRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var tokenHash = tokenService.HashRefreshToken(request.RefreshToken);
        var sessionId = currentUser.SessionId;

        // Thu hồi token gửi lên và cả phiên ghi trong access token (phòng khi FE gửi token cũ sau khi vừa gia hạn).
        var sessions = await refreshTokens.Query()
            .Where(t => t.UserId == userId && t.RevokedAt == null && (t.TokenHash == tokenHash || t.Id == sessionId))
            .ToListAsync(ct);
        if (sessions.Count == 0)
            return;

        var now = timeProvider.GetUtcNow().UtcDateTime;
        foreach (var session in sessions)
            session.Revoke(now);

        await SaveIgnoringConcurrencyAsync(ct);
    }

    public async Task<CurrentUser> GetCurrentUserAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var user = await users.QueryNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException(SessionExpiredMessage);

        var access = await permissionService.GetUserAccessAsync(userId, ct);
        return user.ToCurrentUser(access);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var user = await users.Query().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException(SessionExpiredMessage);

        if (user.IsDemoAccount)
            throw new DomainException("Tài khoản demo không được đổi mật khẩu.");

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            throw new ValidationException(
                [new ValidationFailure(nameof(request.CurrentPassword), "Mật khẩu hiện tại không đúng.")]);
        }

        user.ChangePassword(passwordHasher.Hash(request.NewPassword));

        // Đăng xuất các phiên khác, giữ phiên đang dùng.
        var sessionId = currentUser.SessionId;
        var otherSessions = await refreshTokens.Query()
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.Id != sessionId)
            .ToListAsync(ct);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        foreach (var session in otherSessions)
            session.Revoke(now);

        await unitOfWork.SaveChangesAsync(ct);
    }

    private Guid RequireUserId() =>
        currentUser.UserId ?? throw new UnauthorizedAccessException(SessionExpiredMessage);

    private static string LockedOutMessage(User user, DateTime now)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling((user.LockoutEndAt!.Value - now).TotalMinutes));
        return $"Tài khoản tạm khóa đăng nhập, thử lại sau {minutes} phút";
    }

    /// <summary>Lưu thu hồi token; token đã bị request khác thu hồi trước thì bỏ qua.</summary>
    private async Task SaveIgnoringConcurrencyAsync(CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
        }
    }
}
