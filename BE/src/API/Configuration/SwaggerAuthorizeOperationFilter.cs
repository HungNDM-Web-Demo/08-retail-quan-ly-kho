using API.Base;
using API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace API.Configuration;

/// <summary>
/// Gắn yêu cầu Bearer token cho endpoint cần đăng nhập (endpoint <c>[AllowAnonymous]</c> thì không),
/// thêm phản hồi 401/403 và ghi mã quyền cần có vào mô tả.
/// </summary>
public sealed class SwaggerAuthorizeOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var metadata = context.ApiDescription.ActionDescriptor.EndpointMetadata;
        if (metadata.OfType<IAllowAnonymous>().Any())
            return;

        var scheme = new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = SwaggerSetup.BearerSchemeId }
        };
        operation.Security = [new OpenApiSecurityRequirement { [scheme] = [] }];
        operation.Responses.TryAdd("401", new OpenApiResponse { Description = "Chưa đăng nhập hoặc access token hết hạn" });

        // Mỗi attribute là một điều kiện "có một trong các quyền"; nhiều attribute thì phải qua hết.
        var permissions = metadata.OfType<AuthorizePermissionAttribute>()
            .Select(a => string.Join("` hoặc `", a.Permissions))
            .ToList();
        permissions.AddRange(metadata.OfType<RequireCrudPermissionAttribute>()
            .Select(a => DescribeCrudPermission(context.ApiDescription.RelativePath, a.Operation)));
        permissions = permissions.Distinct().ToList();

        var roles = metadata.OfType<AuthorizeAttribute>().Select(a => a.Roles).Where(r => !string.IsNullOrEmpty(r)).Distinct().ToList();
        if (permissions.Count == 0 && roles.Count == 0)
            return;

        operation.Responses.TryAdd("403", new OpenApiResponse { Description = "Không đủ quyền" });

        var requirement = permissions.Count > 0
            ? $"Quyền: `{string.Join("`, `", permissions)}`."
            : $"Vai trò: `{string.Join("`, `", roles)}`.";
        operation.Description = string.IsNullOrWhiteSpace(operation.Description)
            ? requirement
            : $"{operation.Description}\n\n{requirement}";
    }

    /// <summary>
    /// Mã quyền CRUD chỉ biết khi chạy (truyền qua constructor controller); Swagger suy ra theo quy ước
    /// route <c>api/{resource}</c> trùng tên resource của <see cref="CrudPermissions"/>.
    /// </summary>
    private static string DescribeCrudPermission(string? relativePath, CrudOperation operation)
    {
        var segments = (relativePath ?? string.Empty).Split('/', StringSplitOptions.RemoveEmptyEntries);
        var resource = segments.Length > 1 && segments[0] == "api" ? segments[1] : "{resource}";
        return new CrudPermissions(resource).Get(operation);
    }
}
