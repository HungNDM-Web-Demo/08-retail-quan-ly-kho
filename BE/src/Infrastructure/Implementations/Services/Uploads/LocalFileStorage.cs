using System.Globalization;
using System.Text.RegularExpressions;
using Application.Interfaces.Services.Uploads;
using Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace Infrastructure.Implementations.Services.Uploads;

/// <summary>
/// Lưu file vào thư mục <see cref="FileStorageOptions.RootPath"/> (mặc định wwwroot/uploads), chia thư mục theo năm/tháng,
/// tên file là Guid ngẫu nhiên. API phục vụ tĩnh thư mục này ở <c>/uploads</c>.
/// </summary>
public sealed partial class LocalFileStorage(IOptions<FileStorageOptions> options, TimeProvider timeProvider) : IFileStorage
{
    private readonly FileStorageOptions _options = options.Value;

    public async Task<string> SaveAsync(Stream content, string folder, string extension, CancellationToken ct = default)
    {
        if (!SafeSegmentRegex().IsMatch(folder))
            throw new ArgumentException("Tên thư mục chỉ gồm chữ thường, số, gạch ngang.", nameof(folder));
        if (!SafeSegmentRegex().IsMatch(extension))
            throw new ArgumentException("Phần mở rộng không hợp lệ.", nameof(extension));

        var now = timeProvider.GetUtcNow();
        var year = now.ToString("yyyy", CultureInfo.InvariantCulture);
        var month = now.ToString("MM", CultureInfo.InvariantCulture);
        var fileName = $"{Guid.NewGuid():N}.{extension}";

        var directory = Path.Combine(_options.RootPath, folder, year, month);
        Directory.CreateDirectory(directory);

        await using (var file = new FileStream(Path.Combine(directory, fileName), FileMode.CreateNew, FileAccess.Write))
            await content.CopyToAsync(file, ct);

        return $"{_options.RequestPath.TrimEnd('/')}/{folder}/{year}/{month}/{fileName}";
    }

    public Task DeleteAsync(string relativeUrl, CancellationToken ct = default)
    {
        var prefix = _options.RequestPath.TrimEnd('/') + "/";
        if (string.IsNullOrWhiteSpace(relativeUrl) || !relativeUrl.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            return Task.CompletedTask;

        var root = Path.GetFullPath(_options.RootPath);
        var path = Path.GetFullPath(Path.Combine(root, relativeUrl[prefix.Length..]));

        // Chặn đường dẫn trỏ ra ngoài thư mục gốc (../).
        if (path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && File.Exists(path))
            File.Delete(path);

        return Task.CompletedTask;
    }

    [GeneratedRegex("^[a-z0-9-]+$")]
    private static partial Regex SafeSegmentRegex();
}
