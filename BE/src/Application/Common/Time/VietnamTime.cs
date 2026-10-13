namespace Application.Common.Time;

/// <summary>
/// Giờ Việt Nam (UTC+7). DB lưu UTC; dùng lớp này khi cần hiểu ngày giờ theo giờ Việt Nam
/// (lọc theo ngày, lịch chạy job).
/// </summary>
public static class VietnamTime
{
    public static TimeZoneInfo Zone { get; } = ResolveZone();

    /// <summary>
    /// Đổi giá trị ngày giờ nhận từ query sang UTC: có hậu tố <c>Z</c> hoặc độ lệch múi giờ thì giữ nguyên thời điểm;
    /// không ghi múi giờ (vd <c>2026-10-01</c>) thì hiểu là giờ Việt Nam.
    /// </summary>
    public static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => TimeZoneInfo.ConvertTimeToUtc(value, Zone)
    };

    private static TimeZoneInfo ResolveZone()
    {
        // Windows dùng "SE Asia Standard Time"; Linux (ICU) hiểu cả mã Windows lẫn IANA.
        foreach (var id in new[] { "SE Asia Standard Time", "Asia/Ho_Chi_Minh", "Asia/Bangkok" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone("UTC+07", TimeSpan.FromHours(7), "Giờ Việt Nam", "Giờ Việt Nam");
    }
}
