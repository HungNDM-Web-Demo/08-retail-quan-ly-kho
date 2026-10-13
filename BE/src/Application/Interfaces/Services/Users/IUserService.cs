using Application.DTOs.Users;
using Application.Interfaces.Services.Common;

namespace Application.Interfaces.Services.Users;

/// <summary>Quản lý tài khoản (UC-SYS-05).</summary>
public interface IUserService : ICrudService<UserDto, CreateUserRequest, UpdateUserRequest, UserQuery>
{
    /// <summary>Khóa hoặc mở khóa; không khóa tài khoản demo và chính mình (BR-SYS-05, BR-SYS-10).</summary>
    Task SetActiveAsync(Guid id, LockUserRequest request, CancellationToken ct = default);

    /// <summary>Đặt lại mật khẩu; chặn với tài khoản demo (BR-SYS-05).</summary>
    Task ResetPasswordAsync(Guid id, ResetPasswordRequest request, CancellationToken ct = default);
}
