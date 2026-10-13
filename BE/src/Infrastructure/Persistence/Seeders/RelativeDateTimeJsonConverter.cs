using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Đọc trường DateTime trong file seed: nhận chuỗi ngày tương đối (<see cref="SeedDates"/>) hoặc ngày ISO 8601
/// (không ghi múi giờ thì hiểu là UTC). Trường <c>DateTime?</c> cũng dùng được.
/// </summary>
public sealed class RelativeDateTimeJsonConverter(TimeProvider timeProvider) : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
            throw new JsonException("Ngày trong file seed phải là chuỗi, vd \"daysAgo:3@09:30\" hoặc \"2026-10-01T08:00:00Z\".");

        var value = reader.GetString();
        if (SeedDates.TryParse(value, timeProvider, out var relative))
            return relative;

        if (DateTime.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                out var absolute))
        {
            return absolute;
        }

        throw new JsonException($"Không đọc được ngày '{value}' trong file seed.");
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture));
}
