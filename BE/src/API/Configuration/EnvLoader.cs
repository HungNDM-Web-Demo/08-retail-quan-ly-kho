namespace API.Configuration;

/// <summary>
/// Nạp <c>src/API/.env</c> (KIEN-TRUC-HE-THONG §5.5) và đưa các biến vào cấu hình theo tên mục của ứng dụng.
/// Biến môi trường đặt sẵn trên máy chủ (Docker, IIS) được ưu tiên hơn giá trị trong .env.
/// </summary>
public static class EnvLoader
{
    private static readonly IReadOnlyDictionary<string, string> KeyMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["DB_PROVIDER"] = "Database:Provider",
        ["CONNECTION_STRING"] = "Database:ConnectionString",
        ["JWT_KEY"] = "Jwt:Key",
        ["JWT_ISSUER"] = "Jwt:Issuer",
        ["JWT_AUDIENCE"] = "Jwt:Audience",
        ["JWT_ACCESS_MINUTES"] = "Jwt:AccessMinutes",
        ["JWT_REFRESH_DAYS"] = "Jwt:RefreshDays",
        ["CORS_ORIGINS"] = "Cors:Origins",
        ["DEMO_MODE"] = "Demo:Enabled",
        ["DEMO_PASSWORD"] = "Demo:Password",
        ["DEMO_RESET_CRON"] = "Demo:ResetCron",
        // true khi chạy sau reverse proxy (Docker/Dokploy): tin X-Forwarded-For, X-Forwarded-Proto
        ["BEHIND_PROXY"] = "BehindProxy"
    };

    public static void Load(WebApplicationBuilder builder)
    {
        var envFile = FindEnvFile(builder.Environment.ContentRootPath);
        if (envFile is not null)
            DotNetEnv.Env.NoClobber().Load(envFile);

        var values = new Dictionary<string, string?>();
        foreach (var (envKey, configKey) in KeyMap)
        {
            var value = Environment.GetEnvironmentVariable(envKey);
            if (value is not null)
                values[configKey] = Unquote(value.Trim());
        }

        builder.Configuration.AddInMemoryCollection(values);
    }

    private static string? FindEnvFile(string contentRoot)
    {
        var candidates = new[]
        {
            Path.Combine(contentRoot, ".env"),
            Path.Combine(AppContext.BaseDirectory, ".env"),
            Path.Combine(Directory.GetCurrentDirectory(), ".env")
        };

        return candidates.FirstOrDefault(File.Exists);
    }

    /// <summary>Bỏ cặp ngoặc kép hoặc nháy đơn bao quanh giá trị.</summary>
    private static string Unquote(string value) =>
        value.Length >= 2 && (value[0] == '"' && value[^1] == '"' || value[0] == '\'' && value[^1] == '\'')
            ? value[1..^1]
            : value;
}
