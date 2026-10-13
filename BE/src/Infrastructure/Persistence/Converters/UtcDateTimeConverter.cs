using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Infrastructure.Persistence.Converters;

/// <summary>
/// Ghi DB dạng UTC: Kind = Local thì đổi sang UTC, Kind = Unspecified hiểu là đã UTC (quy ước mọi DateTime trong DB là UTC;
/// Npgsql từ chối ghi giá trị không phải Kind = Utc vào timestamptz). Đọc ra gắn Kind = Utc
/// (SQL Server, SQLite trả về Kind = Unspecified).
/// </summary>
public sealed class UtcDateTimeConverter()
    : ValueConverter<DateTime, DateTime>(
        v => ToUtc(v),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
{
    public static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
