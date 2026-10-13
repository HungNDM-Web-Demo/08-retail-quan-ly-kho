using API.Base;
using Application.DTOs.Auth;
using Application.Interfaces.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Auth;

/// <summary>Đăng nhập, gia hạn phiên, đăng xuất, thông tin tài khoản hiện tại (UC-SYS-01, 03, 04).</summary>
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : BaseApiController
{
    /// <summary>Đăng nhập bằng tên đăng nhập và mật khẩu.</summary>
    /// <remarks>
    /// Sai tên đăng nhập hoặc mật khẩu: 401 với thông báo chung. Sai 5 lần liên tiếp: tạm khóa đăng nhập 5 phút,
    /// trả 400 (BR-SYS-03). Tài khoản bị khóa: 400 (BR-SYS-04). Thông báo nằm ở <c>detail</c>.
    /// </remarks>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct) =>
        Ok(await authService.LoginAsync(request, ct));

    /// <summary>Đổi refresh token lấy cặp token mới.</summary>
    /// <remarks>Mỗi refresh token chỉ dùng được một lần. Token hết hạn, đã dùng, hoặc tài khoản bị khóa thì trả 401.</remarks>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request, CancellationToken ct) =>
        Ok(await authService.RefreshAsync(request, ct));

    /// <summary>Đăng xuất: thu hồi refresh token của phiên hiện tại.</summary>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(LogoutRequest request, CancellationToken ct)
    {
        await authService.LogoutAsync(request, ct);
        return NoContent();
    }

    /// <summary>Thông tin tài khoản đang đăng nhập, vai trò và quyền mới nhất (đọc lại từ DB).</summary>
    [HttpGet("me")]
    [ProducesResponseType<CurrentUser>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CurrentUser>> Me(CancellationToken ct) =>
        Ok(await authService.GetCurrentUserAsync(ct));

    /// <summary>Đổi mật khẩu của chính mình.</summary>
    /// <remarks>Tài khoản demo không được đổi mật khẩu (BR-SYS-05). Các phiên đăng nhập khác bị đăng xuất.</remarks>
    [HttpPut("me/password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await authService.ChangePasswordAsync(request, ct);
        return NoContent();
    }
}
