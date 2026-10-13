using Application.DTOs.Auth;
using Application.Interfaces.Services.Auth;
using Domain.Common;
using Microsoft.Extensions.DependencyInjection;
using UnitTests.TestSupport;

namespace UnitTests.Auth;

/// <summary>
/// BR-SYS-03 qua AuthService thật (DI của Infrastructure, SQLite trong bộ nhớ, đồng hồ giả):
/// sai 5 lần liên tiếp thì tạm khóa đăng nhập 5 phút, kể cả nhập đúng mật khẩu.
/// Sai thông tin: UnauthorizedAccessException (401); tạm khóa: DomainException (400).
/// </summary>
public sealed class LoginLockoutTests : IAsyncLifetime
{
    private const string DemoPassword = SqliteTestHost.DemoPassword;

    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 13, 2, 0, 0, TimeSpan.Zero));
    private SqliteTestHost _host = null!;

    public async Task InitializeAsync()
    {
        _host = new SqliteTestHost(_time);
        await _host.StartAsync();
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task FiveWrongPasswords_LockLoginForFiveMinutes()
    {
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            var error = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => LoginAsync("nhanvien", "SaiMatKhau1"));
            Assert.Equal("Tên đăng nhập hoặc mật khẩu không đúng", error.Message);
        }

        var fifth = await Assert.ThrowsAsync<DomainException>(() => LoginAsync("nhanvien", "SaiMatKhau1"));
        Assert.Equal("Tài khoản tạm khóa đăng nhập, thử lại sau 5 phút", fifth.Message);

        // Đang tạm khóa: mật khẩu đúng vẫn bị từ chối.
        _time.Advance(TimeSpan.FromMinutes(4));
        var whileLocked = await Assert.ThrowsAsync<DomainException>(() => LoginAsync("nhanvien", DemoPassword));
        Assert.Equal("Tài khoản tạm khóa đăng nhập, thử lại sau 1 phút", whileLocked.Message);

        // Hết 5 phút: đăng nhập lại được.
        _time.Advance(TimeSpan.FromMinutes(1));
        var response = await LoginAsync("nhanvien", DemoPassword);
        Assert.Equal("nhanvien", response.User.Username);
        Assert.Equal(["STAFF"], response.User.Roles);
        Assert.Equal(["Nhân viên"], response.User.RoleNames);
    }

    [Fact]
    public async Task SuccessfulLogin_ResetsFailedAttempts()
    {
        for (var attempt = 1; attempt <= 4; attempt++)
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => LoginAsync("quanly", "SaiMatKhau1"));

        await LoginAsync("quanly", DemoPassword);

        // Đã đếm lại từ đầu: thêm 4 lần sai nữa vẫn chưa bị khóa.
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            var error = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => LoginAsync("quanly", "SaiMatKhau1"));
            Assert.Equal("Tên đăng nhập hoặc mật khẩu không đúng", error.Message);
        }
    }

    [Fact]
    public async Task UnknownUsername_ReturnsGenericMessage()
    {
        var error = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => LoginAsync("khongton.tai", DemoPassword));

        Assert.Equal("Tên đăng nhập hoặc mật khẩu không đúng", error.Message);
    }

    private async Task<AuthResponse> LoginAsync(string username, string password)
    {
        await using var scope = _host.CreateScope();
        var auth = scope.ServiceProvider.GetRequiredService<IAuthService>();
        return await auth.LoginAsync(new LoginRequest { Username = username, Password = password });
    }
}
