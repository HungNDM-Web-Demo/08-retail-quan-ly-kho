using API.Middlewares;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Microsoft.AspNetCore.Mvc;

namespace API.Filters;

/// <summary>
/// Kiểm tra quyền của người dùng hiện tại. Quyền đọc mới từ DB (không tin danh sách quyền trong JWT),
/// nên đổi phân quyền có hiệu lực ngay ở request kế tiếp. ADMIN luôn có mọi quyền.
/// </summary>
internal static class PermissionGuard
{
    /// <summary>
    /// Trả null khi có ít nhất một quyền trong <paramref name="anyOfPermissions"/>;
    /// ngược lại trả kết quả 401/403 dạng ProblemDetails.
    /// </summary>
    public static async Task<IActionResult?> CheckAsync(HttpContext httpContext, IReadOnlyList<string> anyOfPermissions)
    {
        var currentUser = httpContext.RequestServices.GetRequiredService<ICurrentUserService>();
        if (currentUser.UserId is not { } userId)
            return Problem(httpContext, StatusCodes.Status401Unauthorized, null);

        var permissionService = httpContext.RequestServices.GetRequiredService<IPermissionService>();
        foreach (var permission in anyOfPermissions)
        {
            if (await permissionService.HasPermissionAsync(userId, permission, httpContext.RequestAborted))
                return null;
        }

        return Problem(
            httpContext,
            StatusCodes.Status403Forbidden,
            $"Bạn không có quyền thực hiện thao tác này (cần quyền {string.Join(" hoặc ", anyOfPermissions)}).");
    }

    private static ObjectResult Problem(HttpContext httpContext, int status, string? detail) =>
        new(ApiProblemDetails.Create(httpContext, status, detail))
        {
            StatusCode = status,
            ContentTypes = { ApiProblemDetails.ContentType }
        };
}
