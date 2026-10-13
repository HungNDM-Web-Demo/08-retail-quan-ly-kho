using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Infrastructure.Persistence.Converters;

/// <summary>Bản cho cột cho phép null của <see cref="UtcDateTimeConverter"/>.</summary>
public sealed class NullableUtcDateTimeConverter()
    : ValueConverter<DateTime?, DateTime?>(
        v => v.HasValue ? UtcDateTimeConverter.ToUtc(v.Value) : v,
        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
