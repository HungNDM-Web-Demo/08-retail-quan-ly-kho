using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Đọc file JSON dữ liệu mẫu nhúng trong assembly. Nguồn duy nhất là FE/src/mock/seed/*.json
/// (Infrastructure.csproj nhúng mọi file .json ở đó với tên resource <c>Seed.{tên file}</c>).
/// Trường DateTime nhận chuỗi ngày tương đối <c>daysAgo:N@HH:mm</c>, <c>dayOffset:N@HH:mm</c> (xem <see cref="SeedDates"/>).
/// </summary>
public static class SeedJson
{
    private const string ResourcePrefix = "Seed.";

    private static readonly Assembly ResourceAssembly = typeof(SeedJson).Assembly;

    /// <summary>Tùy chọn đọc mặc định, ngày tương đối tính theo đồng hồ hệ thống.</summary>
    public static JsonSerializerOptions Options { get; } = CreateOptions(TimeProvider.System);

    /// <summary>camelCase, không phân biệt hoa thường, bỏ qua comment, enum dạng chuỗi, ngày tương đối theo <paramref name="timeProvider"/>.</summary>
    public static JsonSerializerOptions CreateOptions(TimeProvider timeProvider) => new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        Converters = { new JsonStringEnumConverter(), new RelativeDateTimeJsonConverter(timeProvider) }
    };

    public static bool Exists(string fileName) =>
        ResourceAssembly.GetManifestResourceInfo(ResourcePrefix + fileName) is not null;

    /// <summary>
    /// Đọc file bắt buộc phải có, vd <c>Read&lt;List&lt;OrderSeed&gt;&gt;("orders.json", timeProvider)</c>.
    /// Truyền <paramref name="timeProvider"/> của DI để ngày tương đối tính đúng "hôm nay" (và giả lập được khi test).
    /// </summary>
    public static T Read<T>(string fileName, TimeProvider? timeProvider = null) =>
        ReadOptional<T>(fileName, timeProvider)
        ?? throw new InvalidOperationException(
            $"Không đọc được file seed '{fileName}'. Kiểm tra file có trong FE/src/mock/seed và build lại BE.");

    /// <summary>Đọc file nếu có; không có thì trả null.</summary>
    public static T? ReadOptional<T>(string fileName, TimeProvider? timeProvider = null)
    {
        using var stream = ResourceAssembly.GetManifestResourceStream(ResourcePrefix + fileName);
        if (stream is null)
            return default;

        try
        {
            var options = timeProvider is null ? Options : CreateOptions(timeProvider);
            return JsonSerializer.Deserialize<T>(stream, options);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"File seed '{fileName}' không hợp lệ: {ex.Message}", ex);
        }
    }
}
