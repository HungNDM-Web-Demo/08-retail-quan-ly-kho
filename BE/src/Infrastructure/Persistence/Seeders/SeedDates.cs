using System.Globalization;
using System.Text.RegularExpressions;
using Application.Common.Time;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Ngày tương đối trong file seed, dùng chung với FE mock để hai chế độ ra cùng số liệu. Định dạng chuỗi (giờ Việt Nam):
/// <list type="bullet">
/// <item><c>daysAgo:N@HH:mm</c>: hôm nay lùi N ngày, vd <c>daysAgo:3@09:30</c>.</item>
/// <item><c>dayOffset:N@HH:mm</c>: hôm nay cộng N ngày (N âm là quá khứ), vd <c>dayOffset:2@14:00</c>.</item>
/// </list>
/// Phần <c>@HH:mm</c> có thể bỏ, khi đó là 00:00. Kết quả là thời điểm UTC để lưu DB.
/// </summary>
public static partial class SeedDates
{
    /// <summary>Hôm nay (giờ Việt Nam) lùi <paramref name="daysAgo"/> ngày, lúc <paramref name="timeOfDay"/> giờ Việt Nam, đổi ra UTC.</summary>
    public static DateTime DaysAgo(TimeProvider timeProvider, int daysAgo, TimeSpan timeOfDay = default) =>
        FromToday(timeProvider, -daysAgo, timeOfDay);

    /// <summary>Hôm nay (giờ Việt Nam) cộng <paramref name="dayOffset"/> ngày, lúc <paramref name="timeOfDay"/>, đổi ra UTC.</summary>
    public static DateTime FromToday(TimeProvider timeProvider, int dayOffset, TimeSpan timeOfDay = default)
    {
        var todayInVietnam = TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), VietnamTime.Zone).Date;
        var local = DateTime.SpecifyKind(todayInVietnam.AddDays(dayOffset).Add(timeOfDay), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(local, VietnamTime.Zone);
    }

    /// <summary>Đọc chuỗi <c>daysAgo:N@HH:mm</c> hoặc <c>dayOffset:N@HH:mm</c>; sai định dạng thì trả false.</summary>
    public static bool TryParse(string? value, TimeProvider timeProvider, out DateTime utc)
    {
        utc = default;
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var match = RelativeDateRegex().Match(value.Trim());
        if (!match.Success)
            return false;

        var days = int.Parse(match.Groups["days"].Value, CultureInfo.InvariantCulture);
        var timeOfDay = TimeSpan.Zero;
        if (match.Groups["hour"].Success)
        {
            var hour = int.Parse(match.Groups["hour"].Value, CultureInfo.InvariantCulture);
            var minute = int.Parse(match.Groups["minute"].Value, CultureInfo.InvariantCulture);
            if (hour > 23 || minute > 59)
                return false;
            timeOfDay = new TimeSpan(hour, minute, 0);
        }

        var isDaysAgo = match.Groups["kind"].Value.Equals("daysAgo", StringComparison.OrdinalIgnoreCase);
        utc = FromToday(timeProvider, isDaysAgo ? -days : days, timeOfDay);
        return true;
    }

    /// <summary>Như <see cref="TryParse"/> nhưng sai định dạng thì ném <see cref="FormatException"/>.</summary>
    public static DateTime Parse(string value, TimeProvider timeProvider) =>
        TryParse(value, timeProvider, out var utc)
            ? utc
            : throw new FormatException($"Ngày tương đối '{value}' không đúng định dạng daysAgo:N@HH:mm hoặc dayOffset:N@HH:mm.");

    [GeneratedRegex(@"^(?<kind>daysAgo|dayOffset):(?<days>-?\d{1,5})(@(?<hour>\d{1,2}):(?<minute>\d{2}))?$", RegexOptions.IgnoreCase)]
    private static partial Regex RelativeDateRegex();
}
