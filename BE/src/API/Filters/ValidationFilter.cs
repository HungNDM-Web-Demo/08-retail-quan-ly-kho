using Application.Behaviors;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Bộ lọc toàn cục: chạy validator FluentValidation cho mọi tham số của action (body, query) trước khi gọi service.
/// Lỗi ném <c>ValidationException</c>, ExceptionMiddleware trả 400 kèm <c>errors</c>.
/// </summary>
public sealed class ValidationFilter(ValidationBehavior validation) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is not null and not CancellationToken)
                await validation.ValidateAsync(argument, context.HttpContext.RequestAborted);
        }

        await next();
    }
}
