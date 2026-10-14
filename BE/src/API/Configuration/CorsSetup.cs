namespace API.Configuration;

public static class CorsSetup
{
    public const string PolicyName = "Frontend";

    private const string DefaultOrigin = "http://localhost:3108";

    /// <summary>Cho phép FE gọi API. <c>CORS_ORIGINS</c> gồm nhiều origin cách nhau bằng dấu phẩy.</summary>
    public static IServiceCollection AddFrontendCors(this IServiceCollection services, IConfiguration configuration)
    {
        var origins = (configuration["Cors:Origins"] ?? DefaultOrigin)
            .Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(origin => origin.TrimEnd('/'))
            .ToArray();

        services.AddCors(options => options.AddPolicy(PolicyName, policy => policy
            .WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials() // SignalR client gửi negotiate kèm credentials
            .WithExposedHeaders("Location", "Content-Disposition")));

        return services;
    }
}
