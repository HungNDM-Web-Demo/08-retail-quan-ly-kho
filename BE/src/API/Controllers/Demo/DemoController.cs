using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Auth;
using Application.DTOs.Demo;
using Application.Interfaces.Services.Demo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Demo;

/// <summary>Tính năng riêng cho demo (UC-SYS-02, 09, 10). Chỉ có khi <c>DEMO_MODE=true</c>.</summary>
[Route("api/demo")]
[DemoOnly]
public sealed class DemoController(IDemoService demoService) : BaseApiController
{
    /// <summary>Tài khoản demo cho nút "Đăng nhập nhanh", theo thứ tự hiển thị.</summary>
    [HttpGet("accounts")]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyList<DemoAccount>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DemoAccount>>> GetAccounts(CancellationToken ct) =>
        Ok(await demoService.GetAccountsAsync(ct));

    /// <summary>Đăng nhập nhanh bằng mã vai trò (ADMIN, MANAGER, STAFF…), không cần mật khẩu.</summary>
    [HttpPost("login-as")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AuthResponse>> LoginAs(LoginAsRequest request, CancellationToken ct) =>
        Ok(await demoService.LoginAsAsync(request, ct));

    /// <summary>Đặt lại dữ liệu demo: xóa dữ liệu nghiệp vụ và nạp lại bản mẫu (BR-SYS-09).</summary>
    /// <remarks>Giữ nguyên tài khoản, vai trò, cài đặt, nhật ký.</remarks>
    [HttpPost("reset")]
    [Authorize(Roles = RoleCodes.Admin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reset(CancellationToken ct)
    {
        await demoService.ResetAsync(ct);
        return NoContent();
    }
}
