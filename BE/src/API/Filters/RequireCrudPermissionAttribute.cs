using API.Base;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Kiểm tra quyền cho action của <see cref="CrudApiController{TService, TDto, TCreate, TUpdate, TQuery}"/>,
/// mã quyền lấy từ <see cref="ICrudPermissionProvider.CrudPermissions"/> của controller.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class RequireCrudPermissionAttribute(CrudOperation operation) : Attribute, IAsyncActionFilter, IOrderedFilter
{
    public CrudOperation Operation { get; } = operation;

    /// <summary>Chạy trước bộ lọc kiểm tra dữ liệu (-2000): thiếu quyền thì trả 403 trước khi báo lỗi dữ liệu.</summary>
    public int Order => -3000;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.Controller is not ICrudPermissionProvider provider)
        {
            throw new InvalidOperationException(
                $"{context.Controller.GetType().Name} phải cài đặt {nameof(ICrudPermissionProvider)} để dùng {nameof(RequireCrudPermissionAttribute)}.");
        }

        var result = await PermissionGuard.CheckAsync(context.HttpContext, [provider.CrudPermissions.Get(Operation)]);
        if (result is not null)
        {
            context.Result = result;
            return;
        }

        await next();
    }
}
