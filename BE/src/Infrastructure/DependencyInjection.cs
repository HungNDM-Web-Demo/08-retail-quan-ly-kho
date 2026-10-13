using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Auth;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Repositories;
using Infrastructure.Implementations.Services.Auth;
using Infrastructure.Options;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Interceptors;
using Infrastructure.Persistence.Seeders;
using Infrastructure.Security;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Đăng ký cấu hình, AppDbContext, repository, bảo mật, seeder, service (quét tự động), health check, job nền.
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.AddHttpContextAccessor();

        AddOptions(services, configuration);

        // Persistence: một AppDbContext, một IUnitOfWork, repository generic.
        services.AddScoped<AuditSaveChangesInterceptor>();
        services.AddDbContext<AppDbContext>((provider, options) =>
        {
            var database = provider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            options.UseProvider(database.Provider, database.ConnectionString);
            options.AddInterceptors(provider.GetRequiredService<AuditSaveChangesInterceptor>());
        });
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Seed và đặt lại dữ liệu demo. Dự án thay dữ liệu mẫu bằng cách sửa DemoDataSeeder
        // hoặc đăng ký IDemoDataSeeder khác trước khi gọi AddInfrastructure.
        services.AddScoped<SystemSeeder>();
        services.TryAddScoped<IDemoDataSeeder, DemoDataSeeder>();
        services.AddScoped<DemoDataResetter>();
        services.AddScoped<DatabaseInitializer>();

        // Bảo mật.
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddScoped<AuthSessionIssuer>();

        // Service nghiệp vụ: mọi class trong Implementations/Services/** tự đăng ký theo interface Application.
        services.AddScannedServices(typeof(DependencyInjection).Assembly);

        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
        // Job nền: mọi IHostedService trong BackgroundJobs/ tự đăng ký (DemoResetJob, job riêng của dự án).
        services.AddScannedBackgroundJobs(typeof(DependencyInjection).Assembly);

        return services;
    }

    /// <summary>
    /// Chọn provider EF Core theo <c>DB_PROVIDER</c>. Dùng chung cho lúc chạy và cho <c>dotnet ef</c>
    /// (<see cref="Persistence.DesignTimeDbContextFactory"/>) để hai nơi không lệch nhau.
    /// </summary>
    public static DbContextOptionsBuilder UseProvider(
        this DbContextOptionsBuilder options,
        DatabaseProvider provider,
        string connectionString) => provider switch
    {
        DatabaseProvider.Postgres => options.UseNpgsql(connectionString),
        DatabaseProvider.SqlServer => options.UseSqlServer(connectionString),
        DatabaseProvider.Sqlite => options.UseSqlite(connectionString),
        _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, "DB_PROVIDER không hợp lệ.")
    };

    /// <summary>Tạo bảng, chạy migration, seed dữ liệu nền và dữ liệu mẫu. Gọi một lần lúc khởi động.</summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync(ct);
    }

    private static void AddOptions(IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<DatabaseOptions>()
            .Bind(configuration.GetSection(DatabaseOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.ConnectionString),
                "Thiếu CONNECTION_STRING trong src/API/.env (xem .env.example).")
            .PostConfigure<IHostEnvironment>(ResolveSqlitePath)
            .ValidateOnStart();

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(o => o.HasValidKey(), $"JWT_KEY trong src/API/.env phải dài tối thiểu {JwtOptions.MinKeyBytes} byte.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.Issuer) && !string.IsNullOrWhiteSpace(o.Audience),
                "Thiếu JWT_ISSUER hoặc JWT_AUDIENCE trong src/API/.env.")
            .Validate(o => o.AccessMinutes > 0 && o.RefreshDays > 0,
                "JWT_ACCESS_MINUTES và JWT_REFRESH_DAYS phải lớn hơn 0.")
            .ValidateOnStart();

        services.AddOptions<DemoOptions>()
            .Bind(configuration.GetSection(DemoOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.Password),
                "Thiếu DEMO_PASSWORD trong src/API/.env (mật khẩu chung của tài khoản demo).")
            .Validate(o => o.HasValidResetCron(),
                "DEMO_RESET_CRON không đúng cú pháp cron 5 trường, vd \"0 3 * * *\" (3 giờ sáng mỗi ngày).")
            .ValidateOnStart();

        services.AddOptions<FileStorageOptions>()
            .Configure<IHostEnvironment>((o, environment) =>
            {
                if (string.IsNullOrWhiteSpace(o.RootPath))
                    o.RootPath = Path.Combine(environment.ContentRootPath, "wwwroot", "uploads");
            });
    }

    /// <summary>Đường dẫn file SQLite tương đối được tính từ thư mục gốc của API (ContentRoot).</summary>
    private static void ResolveSqlitePath(DatabaseOptions options, IHostEnvironment environment)
    {
        if (options.Provider != DatabaseProvider.Sqlite || string.IsNullOrWhiteSpace(options.ConnectionString))
            return;

        var builder = new SqliteConnectionStringBuilder(options.ConnectionString);
        if (string.IsNullOrWhiteSpace(builder.DataSource)
            || builder.DataSource == ":memory:"
            || builder.Mode == SqliteOpenMode.Memory
            || Path.IsPathRooted(builder.DataSource))
        {
            return;
        }

        builder.DataSource = Path.GetFullPath(Path.Combine(environment.ContentRootPath, builder.DataSource));
        options.ConnectionString = builder.ToString();
    }
}
