using System.Globalization;

namespace Application.Common.Time;

/// <summary>
/// Quy đổi giữa ngày theo giờ Việt Nam (tham số <c>from</c>, <c>to</c> dạng <c>yyyy-MM-dd</c>, mã chứng từ, báo cáo)
/// và thời điểm UTC lưu trong DB (06 §3).
/// </summary>
public static class VietnamDates
{
    public const string DateFormat = "yyyy-MM-dd";

    /// <summary>Giờ Việt Nam tương ứng với một thời điểm UTC.</summary>
    public static DateTime ToVietnam(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), VietnamTime.Zone);

    public static DateTime NowVietnam(TimeProvider timeProvider) => ToVietnam(timeProvider.GetUtcNow().UtcDateTime);

    public static DateOnly Today(TimeProvider timeProvider) => DateOnly.FromDateTime(NowVietnam(timeProvider));

    public static DateOnly DateOf(DateTime utc) => DateOnly.FromDateTime(ToVietnam(utc));

    /// <summary>00:00 ngày <paramref name="date"/> giờ Việt Nam, đổi ra UTC.</summary>
    public static DateTime StartOfDayUtc(DateOnly date) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified), VietnamTime.Zone);

    /// <summary>00:00 ngày kế tiếp (mốc trên không gồm) của <paramref name="date"/>.</summary>
    public static DateTime EndOfDayExclusiveUtc(DateOnly date) => StartOfDayUtc(date.AddDays(1));

    /// <summary>23:59:59 ngày <paramref name="date"/> giờ Việt Nam, đổi ra UTC (hạn dùng, ngày kết thúc khuyến mãi).</summary>
    public static DateTime EndOfDayUtc(DateOnly date) => EndOfDayExclusiveUtc(date).AddSeconds(-1);

    public static string Format(DateOnly date) => date.ToString(DateFormat, CultureInfo.InvariantCulture);

    public static bool TryParse(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value?.Trim(), DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    /// <summary>Đọc <c>HH:mm</c> (khung giờ khuyến mãi).</summary>
    public static bool TryParseTime(string? value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value?.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);

    public static string FormatTime(TimeOnly time) => time.ToString("HH:mm", CultureInfo.InvariantCulture);
}
