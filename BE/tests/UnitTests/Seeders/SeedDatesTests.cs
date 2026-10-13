using System.Text.Json;
using Infrastructure.Persistence.Seeders;
using UnitTests.TestSupport;

namespace UnitTests.Seeders;

/// <summary>Ngày tương đối "daysAgo:N@HH:mm", "dayOffset:N@HH:mm" theo giờ Việt Nam (UTC+7).</summary>
public class SeedDatesTests
{
    // 02:00 UTC = 09:00 ngày 13/10/2026 giờ Việt Nam.
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 13, 2, 0, 0, TimeSpan.Zero));

    [Theory]
    [InlineData("daysAgo:3@09:30", "2026-10-10T02:30:00Z")]
    [InlineData("daysAgo:0@00:00", "2026-10-12T17:00:00Z")]
    [InlineData("daysAgo:1", "2026-10-11T17:00:00Z")]
    [InlineData("dayOffset:2@14:00", "2026-10-15T07:00:00Z")]
    [InlineData("dayOffset:-7@23:59", "2026-10-06T16:59:00Z")]
    [InlineData("DAYSAGO:30@8:05", "2026-09-13T01:05:00Z")]
    public void TryParse_ValidValue_ReturnsUtc(string value, string expectedUtc)
    {
        Assert.True(SeedDates.TryParse(value, _time, out var utc));
        Assert.Equal(DateTime.Parse(expectedUtc).ToUniversalTime(), utc);
        Assert.Equal(DateTimeKind.Utc, utc.Kind);
    }

    [Fact]
    public void Today_FollowsVietnamDate_NotUtcDate()
    {
        // 20:00 UTC ngày 13/10 đã là 03:00 ngày 14/10 ở Việt Nam.
        var lateUtc = new FakeTimeProvider(new DateTimeOffset(2026, 10, 13, 20, 0, 0, TimeSpan.Zero));

        var utc = SeedDates.Parse("daysAgo:0@08:00", lateUtc);

        Assert.Equal(new DateTime(2026, 10, 14, 1, 0, 0, DateTimeKind.Utc), utc);
    }

    [Theory]
    [InlineData("")]
    [InlineData("3")]
    [InlineData("daysAgo:")]
    [InlineData("daysAgo:3@25:00")]
    [InlineData("daysAgo:3@09:60")]
    [InlineData("hoursAgo:3")]
    [InlineData("2026-10-01")]
    public void TryParse_InvalidValue_ReturnsFalse(string value)
    {
        Assert.False(SeedDates.TryParse(value, _time, out _));
    }

    [Fact]
    public void JsonConverter_ReadsRelativeAndIsoDates()
    {
        const string json = """
            [
              { "code": "DH001", "orderedAt": "daysAgo:2@10:15", "paidAt": null },
              { "code": "DH002", "orderedAt": "2026-10-01T08:00:00Z", "paidAt": "dayOffset:0@12:00" }
            ]
            """;

        var orders = JsonSerializer.Deserialize<List<OrderSeed>>(json, SeedJson.CreateOptions(_time))!;

        Assert.Equal(new DateTime(2026, 10, 11, 3, 15, 0, DateTimeKind.Utc), orders[0].OrderedAt);
        Assert.Null(orders[0].PaidAt);
        Assert.Equal(new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc), orders[1].OrderedAt);
        Assert.Equal(new DateTime(2026, 10, 13, 5, 0, 0, DateTimeKind.Utc), orders[1].PaidAt);
    }

    private sealed record OrderSeed(string Code, DateTime OrderedAt, DateTime? PaidAt);
}
