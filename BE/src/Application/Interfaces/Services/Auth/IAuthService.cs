using Application.DTOs.Auth;

namespace Application.Interfaces.Services.Auth;

/// <summary>Đăng nhập, gia hạn phiên, đăng xuất, thông tin và mật khẩu của người dùng hiện tại (UC-SYS-01, 03, 04).</summary>
public interface IAuthService
{
    /// <summary>Đăng nhập; sai 5 lần liên tiếp thì tạm khóa 5 phút (BR-SYS-03).</summary>
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);

    /// <summary>Đổi refresh token (dùng một lần) lấy cặp token mới; tài khoản bị khóa thì từ chối (BR-SYS-04).</summary>
    Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default);

    /// <summary>Thu hồi refresh token của phiên hiện tại.</summary>
    Task LogoutAsync(LogoutRequest request, CancellationToken ct = default);

    /// <summary>Thông tin tài khoản hiện tại, vai trò và quyền đọc mới từ DB.</summary>
    Task<CurrentUser> GetCurrentUserAsync(CancellationToken ct = default);

    /// <summary>Đổi mật khẩu của chính mình; chặn với tài khoản demo (BR-SYS-05).</summary>
    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default);
}
