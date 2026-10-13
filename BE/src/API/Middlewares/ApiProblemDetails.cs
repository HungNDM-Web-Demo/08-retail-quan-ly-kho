using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace API.Middlewares;

/// <summary>
/// Chuẩn hóa ProblemDetails (RFC 7807, QUY-UOC-API §1.3) cho mọi lỗi: do exception, do framework (401, 403, 404, 405),
/// do model binding. FE dựa vào <c>detail</c> để hiển thị và <c>errors</c> (key camelCase) để gắn lỗi vào ô nhập.
/// </summary>
public static class ApiProblemDetails
{
    public const string ContentType = "application/problem+json";

    public static ProblemDetails Create(HttpContext httpContext, int status, string? detail = null)
    {
        var problem = new ProblemDetails { Status = status, Detail = detail };
        ApplyDefaults(problem, httpContext);
        return problem;
    }

    public static ValidationProblemDetails CreateValidation(
        HttpContext httpContext,
        IDictionary<string, string[]> errors,
        int status = StatusCodes.Status400BadRequest,
        string? detail = null)
    {
        var problem = new ValidationProblemDetails(errors)
        {
            Status = status,
            Detail = detail ?? "Dữ liệu gửi lên không hợp lệ."
        };
        ApplyDefaults(problem, httpContext);
        return problem;
    }

    /// <summary>Điền type, title, detail mặc định tiếng Việt, instance, traceId.</summary>
    public static void ApplyDefaults(ProblemDetails problem, HttpContext httpContext)
    {
        var status = problem.Status ?? httpContext.Response.StatusCode;
        problem.Status = status;
        problem.Type = $"https://httpstatuses.io/{status}";
        problem.Title = ReasonPhrases.GetReasonPhrase(status) is { Length: > 0 } phrase ? phrase : problem.Title;
        problem.Detail ??= DefaultDetail(status);
        problem.Instance ??= httpContext.Request.Path;
        problem.Extensions["traceId"] = Activity.Current?.Id ?? httpContext.TraceIdentifier;
    }

    public static async Task WriteAsync(HttpContext httpContext, ProblemDetails problem)
    {
        httpContext.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(problem, problem.GetType(), options: null, contentType: ContentType);
    }

    /// <summary>
    /// Đổi tên trường về dạng camelCase như JSON gửi lên: <c>Items[0].Key</c> → <c>items[0].key</c>,
    /// <c>$.roleIds[0]</c> → <c>roleIds[0]</c>.
    /// </summary>
    public static string ToFieldName(string key)
    {
        var name = key.StartsWith("$.", StringComparison.Ordinal) ? key[2..] : key.TrimStart('$');
        return string.Join('.', name.Split('.').Select(segment => segment.Length == 0 ? segment : JsonNamingPolicy.CamelCase.ConvertName(segment)));
    }

    private static string? DefaultDetail(int status) => status switch
    {
        StatusCodes.Status400BadRequest => "Yêu cầu không hợp lệ.",
        StatusCodes.Status401Unauthorized => "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.",
        StatusCodes.Status403Forbidden => "Bạn không có quyền thực hiện thao tác này.",
        StatusCodes.Status404NotFound => "Không tìm thấy dữ liệu yêu cầu.",
        StatusCodes.Status405MethodNotAllowed => "Phương thức HTTP không được hỗ trợ ở đường dẫn này.",
        StatusCodes.Status409Conflict => "Dữ liệu bị trùng hoặc xung đột.",
        StatusCodes.Status413PayloadTooLarge => "Dữ liệu gửi lên quá lớn.",
        StatusCodes.Status415UnsupportedMediaType => "Định dạng dữ liệu gửi lên không được hỗ trợ.",
        StatusCodes.Status500InternalServerError => "Đã có lỗi xảy ra, vui lòng thử lại sau.",
        StatusCodes.Status503ServiceUnavailable => "Hệ thống tạm thời không phục vụ được, vui lòng thử lại sau.",
        _ => null
    };
}
