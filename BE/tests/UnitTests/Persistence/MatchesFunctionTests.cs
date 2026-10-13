using Application.DTOs.Users;
using Application.Interfaces.Services.Users;
using Infrastructure.Extensions;
using Microsoft.Extensions.DependencyInjection;
using UnitTests.TestSupport;

namespace UnitTests.Persistence;

/// <summary>
/// <see cref="AppDbFunctions.Matches"/> qua UserService thật trên SQLite trong bộ nhớ: tìm không phân biệt hoa thường
/// với chữ không dấu, ký tự đặc biệt của LIKE được hiểu theo nghĩa đen, cột null không khớp.
/// Tìm không dấu ("nguyen" khớp "Nguyễn") chỉ có trên Postgres (unaccent), không kiểm ở đây.
/// </summary>
public sealed class MatchesFunctionTests : IAsyncLifetime
{
    private SqliteTestHost _host = null!;

    public async Task InitializeAsync()
    {
        _host = new SqliteTestHost(TimeProvider.System);
        await _host.StartAsync();
    }

    public async Task DisposeAsync() => await _host.DisposeAsync();

    [Theory]
    [InlineData("MINH", "admin")]
    [InlineData("minh", "admin")]
    [InlineData("mAi", "quanly")]
    [InlineData("NHANVIEN@EXAMPLE", "nhanvien")]
    [InlineData("0123456783", "nhanvien")]
    public async Task Search_IsCaseInsensitiveForAscii(string search, string expectedUsername)
    {
        var page = await SearchAsync(search);

        var found = Assert.Single(page.Items);
        Assert.Equal(expectedUsername, found.Username);
    }

    [Theory]
    [InlineData("%")]
    [InlineData("_")]
    [InlineData("a%n")]
    [InlineData("\\")]
    public async Task Search_TreatsLikeWildcardsLiterally(string search)
    {
        var page = await SearchAsync(search);

        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task Search_NoMatch_ReturnsEmpty()
    {
        var page = await SearchAsync("khong-co-ai");

        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public void Matches_CalledOutsideQuery_Throws() =>
        Assert.Throws<InvalidOperationException>(() => AppDbFunctions.Matches("a", "%a%"));

    private async Task<Application.Common.Models.PaginatedResult<UserDto>> SearchAsync(string search)
    {
        await using var scope = _host.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserService>();
        return await users.GetPagedAsync(new UserQuery { Search = search });
    }
}
