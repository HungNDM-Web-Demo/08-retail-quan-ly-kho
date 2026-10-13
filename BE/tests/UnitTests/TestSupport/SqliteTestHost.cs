using Application;
using Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace UnitTests.TestSupport;

/// <summary>
/// Dựng DI thật của Application + Infrastructure trên SQLite trong bộ nhớ (EnsureCreated + SystemSeeder),
/// cho test tích hợp service. Mỗi instance là một DB riêng; <see cref="DisposeAsync"/> xóa DB.
/// </summary>
public sealed class SqliteTestHost(TimeProvider timeProvider) : IAsyncDisposable
{
    public const string DemoPassword = "Demo@123";

    private readonly string _connectionString = $"Data Source=test-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
    private SqliteConnection _keepAlive = null!;

    public ServiceProvider Services { get; private set; } = null!;

    public async Task StartAsync()
    {
        // Giữ một kết nối mở để DB SQLite trong bộ nhớ tồn tại suốt bài test.
        _keepAlive = new SqliteConnection(_connectionString);
        await _keepAlive.OpenAsync();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:Provider"] = "Sqlite",
                ["Database:ConnectionString"] = _connectionString,
                ["Jwt:Key"] = new string('k', 48),
                ["Jwt:Issuer"] = "unit-test",
                ["Jwt:Audience"] = "unit-test",
                ["Demo:Enabled"] = "false",
                ["Demo:Password"] = DemoPassword
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(timeProvider);
        services.AddSingleton<IHostEnvironment>(new TestHostEnvironment());
        services.AddApplication();
        services.AddInfrastructure(configuration);
        Services = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true });

        await Services.InitializeDatabaseAsync();
    }

    public AsyncServiceScope CreateScope() => Services.CreateAsyncScope();

    public async ValueTask DisposeAsync()
    {
        if (Services is not null)
            await Services.DisposeAsync();
        if (_keepAlive is not null)
            await _keepAlive.DisposeAsync();
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "UnitTests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
