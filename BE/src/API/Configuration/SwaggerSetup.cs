using Microsoft.OpenApi.Models;

namespace API.Configuration;

public static class SwaggerSetup
{
    public const string BearerSchemeId = "Bearer";

    /// <summary>Swagger có mô tả tiếng Việt (tài liệu XML) và nút Authorize nhập access token.</summary>
    public static IServiceCollection AddSwaggerDocumentation(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Quản lý Kho API",
                Version = "v1",
                Description = "API của demo. Đăng nhập (POST /api/auth/login, hoặc đăng nhập nhanh khi bật DEMO_MODE), "
                    + "bấm Authorize rồi dán accessToken để thử các API cần đăng nhập."
            });

            options.AddSecurityDefinition(BearerSchemeId, new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Name = "Authorization",
                Description = "Dán accessToken, không cần gõ chữ Bearer."
            });
            options.OperationFilter<SwaggerAuthorizeOperationFilter>();
            options.SupportNonNullableReferenceTypes();

            foreach (var assemblyName in new[] { "API", "Application" })
            {
                var xmlPath = Path.Combine(AppContext.BaseDirectory, $"{assemblyName}.xml");
                if (File.Exists(xmlPath))
                    options.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
            }
        });

        return services;
    }

    public static WebApplication UseSwaggerDocumentation(this WebApplication app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.DocumentTitle = "Quản lý Kho API";
            options.EnablePersistAuthorization();
            options.DisplayRequestDuration();
        });
        return app;
    }
}
