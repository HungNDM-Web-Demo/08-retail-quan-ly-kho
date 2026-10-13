namespace Application.Interfaces.Services.Common;

/// <summary>
/// Người dùng của request hiện tại, đọc từ JWT. Không truy cập DB; quyền mới nhất lấy qua <c>IPermissionService</c>.
/// Job nền (không có request) nhận giá trị null.
/// </summary>
public interface ICurrentUserService
{
    Guid? UserId { get; }

    string? Username { get; }

    /// <summary>Mã phiên đăng nhập (claim <c>sid</c>), trùng Id của refresh token đang dùng.</summary>
    Guid? SessionId { get; }

    bool IsAuthenticated { get; }

    string? IpAddress { get; }
}
