using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Users;
using Application.Interfaces.Services.Users;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Users;

/// <summary>Quản lý tài khoản (UC-SYS-05). Danh sách lọc thêm theo <c>roleId</c>, <c>isActive</c>.</summary>
[Route("api/users")]
public sealed class UsersController(IUserService service)
    : CrudApiController<IUserService, UserDto, CreateUserRequest, UpdateUserRequest, UserQuery>(service, new CrudPermissions("users"))
{
    /// <summary>Khóa hoặc mở khóa tài khoản.</summary>
    /// <remarks>Không khóa được tài khoản demo và chính mình (BR-SYS-05, BR-SYS-10). Khóa xong thì phiên đang mở bị thu hồi.</remarks>
    [HttpPatch("{id:guid}/lock")]
    [AuthorizePermission(Permissions.Users.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Lock(Guid id, LockUserRequest request, CancellationToken ct)
    {
        await Service.SetActiveAsync(id, request, ct);
        return NoContent();
    }

    /// <summary>Đặt lại mật khẩu cho tài khoản.</summary>
    /// <remarks>Không áp dụng cho tài khoản demo (BR-SYS-05). Các phiên đang mở của tài khoản bị thu hồi.</remarks>
    [HttpPatch("{id:guid}/reset-password")]
    [AuthorizePermission(Permissions.Users.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResetPassword(Guid id, ResetPasswordRequest request, CancellationToken ct)
    {
        await Service.ResetPasswordAsync(id, request, ct);
        return NoContent();
    }
}
