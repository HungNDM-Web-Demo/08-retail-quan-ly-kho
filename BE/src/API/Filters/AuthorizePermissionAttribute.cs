using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Chặn endpoint theo mã quyền, vd <c>[AuthorizePermission(Permissions.Orders.Cancel)]</c>.
/// Truyền nhiều mã trong một attribute thì chỉ cần có một trong các quyền đó;
/// gắn nhiều attribute thì phải qua hết. Chạy ở bước phân quyền, trước khi đọc dữ liệu gửi lên.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class AuthorizePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    public AuthorizePermissionAttribute(params string[] permissions)
    {
        if (permissions.Length == 0)
            throw new ArgumentException("Cần ít nhất một mã quyền.", nameof(permissions));

        Permissions = permissions;
    }

    /// <summary>Các mã quyền, chỉ cần có một.</summary>
    public IReadOnlyList<string> Permissions { get; }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var result = await PermissionGuard.CheckAsync(context.HttpContext, Permissions);
        if (result is not null)
            context.Result = result;
    }
}
