using System.Text.Json.Serialization;
using API.Filters;
using API.Middlewares;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace API.Configuration;

public static class ApiServiceCollectionExtensions
{
    /// <summary>Controller, JSON, ProblemDetails, xác thực JWT, phân quyền, CORS, Swagger.</summary>
    public static IServiceCollection AddApiPresentation(this IServiceCollection services, IConfiguration configuration)
    {
        var demoEnabled = configuration.GetValue<bool>("Demo:Enabled");

        services
            .AddControllers(options =>
            {
                options.Filters.Add<ValidationFilter>();
                options.Conventions.Add(new DemoOnlyControllersConvention(demoEnabled));

                // Để FluentValidation báo lỗi bằng tiếng Việt thay vì MVC tự coi chuỗi không null là bắt buộc.
                options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
            })
            .AddJsonOptions(options =>
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
            .ConfigureApiBehaviorOptions(options =>
                options.InvalidModelStateResponseFactory = CreateInvalidModelStateResponse);

        services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        // Lỗi framework (401, 403, 404, 405…) cũng trả ProblemDetails cùng định dạng.
        services.AddProblemDetails(options =>
            options.CustomizeProblemDetails = context => ApiProblemDetails.ApplyDefaults(context.ProblemDetails, context.HttpContext));

        services.AddJwtAuthentication();
        services.AddFrontendCors(configuration);
        services.AddSwaggerDocumentation();

        return services;
    }

    /// <summary>Lỗi đọc dữ liệu (JSON sai, sai kiểu, thiếu trường bắt buộc) trả 400 với key camelCase như lỗi validate.</summary>
    private static IActionResult CreateInvalidModelStateResponse(ActionContext context)
    {
        var bodyParameters = context.ActionDescriptor.Parameters
            .Where(p => p.BindingInfo?.BindingSource == BindingSource.Body)
            .Select(p => p.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var errors = new Dictionary<string, string[]>();
        foreach (var (key, entry) in context.ModelState)
        {
            if (entry.Errors.Count == 0)
                continue;

            var field = bodyParameters.Contains(key) ? string.Empty : ApiProblemDetails.ToFieldName(key);
            errors[field] = [field.Length == 0 ? "Dữ liệu gửi lên thiếu hoặc không đúng định dạng JSON." : "Giá trị không hợp lệ."];
        }

        var problem = ApiProblemDetails.CreateValidation(context.HttpContext, errors);
        return new BadRequestObjectResult(problem) { ContentTypes = { ApiProblemDetails.ContentType } };
    }
}
