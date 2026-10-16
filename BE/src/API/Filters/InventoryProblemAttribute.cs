using API.Middlewares;
using Application.Common.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Đưa trường <c>code</c> (07 §2.12) vào ProblemDetails của lỗi 403, 404 nghiệp vụ kho (<see cref="CodedForbiddenException"/>,
/// <see cref="CodedNotFoundException"/>). Lỗi 400, 409 có <c>code</c> đã đi qua ExceptionMiddleware của nền.
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class InventoryProblemAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        var (status, code) = context.Exception switch
        {
            CodedForbiddenException forbidden => (StatusCodes.Status403Forbidden, forbidden.Code),
            CodedNotFoundException notFound => (StatusCodes.Status404NotFound, notFound.Code),
            _ => (0, null)
        };
        if (code is null)
            return;

        var problem = ApiProblemDetails.Create(context.HttpContext, status, context.Exception.Message);
        problem.Extensions["code"] = code;
        context.Result = new ObjectResult(problem) { StatusCode = status, ContentTypes = { ApiProblemDetails.ContentType } };
        context.ExceptionHandled = true;
    }
}
