using Application;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Common;
using Domain.Entities.System.Users;
using Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace UnitTests.TestSupport;

/// <summary>
/// DI thật của Application + Infrastructure trên SQLite trong bộ nhớ, <c>DEMO_MODE=true</c> nên <c>demo-data.json</c> được nạp
/// như khi chạy thật (theo mẫu <c>PosTestHost</c> của dự án 04). Đồng hồ giả: 12:00 thứ Năm 15/10/2026 giờ Việt Nam.
/// Dữ liệu mẫu nạp một lần vào DB mẫu rồi sao chép (SQLite backup) cho từng test. Người dùng đổi bằng <see cref="SignInAsync"/>.
/// </summary>
public sealed class KhoTestHost : IAsyncDisposable
{
    public const string DemoPassword = "Demo@123";

    /// <summary>05:00 UTC = 12:00 giờ Việt Nam.</summary>
    public static readonly DateTimeOffset Start = new(2026, 10, 15, 5, 0, 0, TimeSpan.Zero);

    private static readonly SemaphoreSlim TemplateGate = new(1, 1);
    private static SqliteConnection? _template;

    private readonly SqliteConnection _keepAlive;
    private readonly ServiceProvider _services;

    private KhoTestHost(SqliteConnection keepAlive, ServiceProvider services, FakeTimeProvider time, TestCurrentUser currentUser)
    {
        _keepAlive = keepAlive;
        _services = services;
        Time = time;
        CurrentUser = currentUser;
    }

    public FakeTimeProvider Time { get; }

    public TestCurrentUser CurrentUser { get; }

    public IServiceProvider Services => _services;

    public static async Task<KhoTestHost> StartAsync()
    {
        var (connection, provider, time, user) = Build(Start);
        await TemplateGate.WaitAsync();
        try
        {
            (await TemplateAsync()).BackupDatabase(connection);
        }
        finally
        {
            TemplateGate.Release();
        }

        await provider.InitializeDatabaseAsync();
        return new KhoTestHost(connection, provider, time, user);
    }

    public async Task<T> RunAsync<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    public async Task RunAsync(Func<IServiceProvider, Task> action)
    {
        await using var scope = _services.CreateAsyncScope();
        await action(scope.ServiceProvider);
    }

    /// <summary>Lấy service trong scope mới (như một request) rồi gọi.</summary>
    public Task<T> CallAsync<TService, T>(Func<TService, Task<T>> action)
        where TService : notnull =>
        RunAsync(sp => action(sp.GetRequiredService<TService>()));

    public Task CallAsync<TService>(Func<TService, Task> action)
        where TService : notnull =>
        RunAsync(sp => action(sp.GetRequiredService<TService>()));

    public Task<T> QueryAsync<TEntity, T>(Func<IQueryable<TEntity>, Task<T>> query)
        where TEntity : Domain.Base.BaseEntity =>
        RunAsync(sp => query(sp.GetRequiredService<IGenericRepository<TEntity>>().QueryNoTracking()));

    public async Task<Guid> SignInAsync(string username)
    {
        var userId = await QueryAsync<User, Guid>(q => q.Where(u => u.Username == username).Select(u => u.Id).SingleAsync());
        CurrentUser.Set(userId, username);
        return userId;
    }

    public async ValueTask DisposeAsync()
    {
        await _services.DisposeAsync();
        await _keepAlive.DisposeAsync();
    }

    private static async Task<SqliteConnection> TemplateAsync()
    {
        if (_template is not null)
            return _template;

        var (connection, provider, _, _) = Build(Start);
        await provider.InitializeDatabaseAsync();
        await provider.DisposeAsync();
        _template = connection;
        return connection;
    }

    private static (SqliteConnection Connection, ServiceProvider Provider, FakeTimeProvider Time, TestCurrentUser User) Build(DateTimeOffset start)
    {
        var time = new FakeTimeProvider(start);
        var connectionString = $"Data Source=kho-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        var keepAlive = new SqliteConnection(connectionString);
        keepAlive.Open();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "Sqlite",
                ["Database:ConnectionString"] = connectionString,
                ["Jwt:Key"] = new string('k', 48),
                ["Jwt:Issuer"] = "unit-test",
                ["Jwt:Audience"] = "unit-test",
                ["Demo:Enabled"] = "true",
                ["Demo:Password"] = DemoPassword
            })
            .Build();

        var currentUser = new TestCurrentUser();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(time);
        services.AddSingleton<IHostEnvironment>(new TestHostEnvironment());
        services.AddSingleton<ICurrentUserService>(currentUser);
        services.AddApplication();
        services.AddInfrastructure(configuration);
        var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });
        return (keepAlive, provider, time, currentUser);
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "UnitTests";
        public string ContentRootPath { get; set; } = Path.Combine(AppContext.BaseDirectory, "kho-test-root");
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

/// <summary>Người dùng hiện tại giả, đổi được giữa các bước test.</summary>
public sealed class TestCurrentUser : ICurrentUserService
{
    public Guid? UserId { get; private set; }
    public string? Username { get; private set; }
    public Guid? SessionId => null;
    public bool IsAuthenticated => UserId.HasValue;
    public string? IpAddress => "127.0.0.1";

    public void Set(Guid? userId, string? username)
    {
        UserId = userId;
        Username = username;
    }
}
