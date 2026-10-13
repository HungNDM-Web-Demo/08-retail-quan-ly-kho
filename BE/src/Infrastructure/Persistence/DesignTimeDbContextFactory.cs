using Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Persistence;

/// <summary>
/// Tạo AppDbContext cho lệnh <c>dotnet ef</c> (BE-CAU-TRUC-THU-MUC §5). Đọc <c>DB_PROVIDER</c>, <c>CONNECTION_STRING</c>
/// từ src/API/.env; chưa có .env hoặc thiếu biến thì mặc định Postgres với chuỗi kết nối localhost.
/// Migration trong Infrastructure/Migrations sinh cho Postgres; muốn sinh lại thì đặt <c>DB_PROVIDER=Postgres</c>
/// (lệnh <c>migrations add</c> không cần kết nối DB, <c>database update</c> thì cần).
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string DefaultConnectionString =
        "Host=localhost;Port=5432;Database=WebDemo_RetailQuanLyKho;Username=postgres;Password=postgres";

    public AppDbContext CreateDbContext(string[] args)
    {
        LoadEnvFile();

        var provider = Enum.TryParse<DatabaseProvider>(Environment.GetEnvironmentVariable("DB_PROVIDER"), ignoreCase: true, out var parsed)
            ? parsed
            : DatabaseProvider.Postgres;
        var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            provider = DatabaseProvider.Postgres;
            connectionString = DefaultConnectionString;
        }

        var options = new DbContextOptionsBuilder<AppDbContext>();
        options.UseProvider(provider, connectionString);
        return new AppDbContext(options.Options);
    }

    private static void LoadEnvFile()
    {
        var current = Directory.GetCurrentDirectory();
        var candidates = new[]
        {
            Path.Combine(current, "src", "API", ".env"),
            Path.Combine(current, "..", "API", ".env"),
            Path.Combine(current, ".env")
        };

        var envFile = candidates.Select(Path.GetFullPath).FirstOrDefault(File.Exists);
        if (envFile is not null)
            DotNetEnv.Env.NoClobber().Load(envFile);
    }
}
