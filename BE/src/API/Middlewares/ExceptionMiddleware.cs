using Application.Common.Exceptions;
using Domain.Common;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace API.Middlewares;

/// <summary>
/// Đổi exception thành ProblemDetails (KIEN-TRUC-HE-THONG §5.4). Service chỉ cần ném exception, controller không try/catch.
/// <list type="table">
/// <item><term>ValidationException</term><description>400, kèm <c>errors</c> theo tên trường camelCase.</description></item>
/// <item><term>DomainException</term><description>400, kèm các trường mở rộng (vd <c>missing</c>).</description></item>
/// <item><term>UnauthorizedAccessException</term><description>401.</description></item>
/// <item><term>ForbiddenException</term><description>403.</description></item>
/// <item><term>NotFoundException</term><description>404.</description></item>
/// <item><term>ConflictException</term><description>409, kèm <c>errors</c> khi gắn với một trường.</description></item>
/// <item><term>Khác</term><description>500, ghi log, không lộ chi tiết lỗi (trừ môi trường Development).</description></item>
/// </list>
/// </summary>
public sealed class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IHostEnvironment environment)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client đã ngắt kết nối, không cần trả lời.
        }
        catch (Exception exception)
        {
            if (context.Response.HasStarted)
            {
                logger.LogError(exception, "Lỗi sau khi đã bắt đầu gửi phản hồi: {Path}", context.Request.Path);
                throw;
            }

            var problem = ToProblemDetails(context, exception);
            if (problem.Status >= StatusCodes.Status500InternalServerError)
                logger.LogError(exception, "Lỗi chưa xử lý: {Method} {Path}", context.Request.Method, context.Request.Path);
            else
                logger.LogInformation("{Status} {Method} {Path}: {Message}", problem.Status, context.Request.Method, context.Request.Path, exception.Message);

            context.Response.Clear();
            await ApiProblemDetails.WriteAsync(context, problem);
        }
    }

    private ProblemDetails ToProblemDetails(HttpContext context, Exception exception)
    {
        switch (exception)
        {
            case ValidationException validation:
            {
                var errors = validation.Errors
                    .GroupBy(e => ApiProblemDetails.ToFieldName(e.PropertyName ?? string.Empty))
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray());
                var detail = errors.Count == 1 && errors.Values.First().Length == 1
                    ? errors.Values.First()[0]
                    : null;
                return ApiProblemDetails.CreateValidation(context, errors, detail: detail);
            }

            case DomainException domain:
            {
                var problem = ApiProblemDetails.Create(context, StatusCodes.Status400BadRequest, domain.Message);
                foreach (var (key, value) in domain.Extensions)
                    problem.Extensions[key] = value;
                return problem;
            }

            case ConflictException { Field: { } field } conflict:
                return ApiProblemDetails.CreateValidation(
                    context,
                    new Dictionary<string, string[]> { [ApiProblemDetails.ToFieldName(field)] = [conflict.Message] },
                    StatusCodes.Status409Conflict,
                    conflict.Message);

            case ConflictException conflict:
                return ApiProblemDetails.Create(context, StatusCodes.Status409Conflict, conflict.Message);

            case UnauthorizedAccessException unauthorized:
                return ApiProblemDetails.Create(context, StatusCodes.Status401Unauthorized, unauthorized.Message);

            case ForbiddenException forbidden:
                return ApiProblemDetails.Create(context, StatusCodes.Status403Forbidden, forbidden.Message);

            case NotFoundException notFound:
                return ApiProblemDetails.Create(context, StatusCodes.Status404NotFound, notFound.Message);

            case BadHttpRequestException badRequest:
                return ApiProblemDetails.Create(context, badRequest.StatusCode);

            default:
            {
                var problem = ApiProblemDetails.Create(context, StatusCodes.Status500InternalServerError);
                if (environment.IsDevelopment())
                    problem.Extensions["exception"] = $"{exception.GetType().Name}: {exception.Message}";
                return problem;
            }
        }
    }
}
