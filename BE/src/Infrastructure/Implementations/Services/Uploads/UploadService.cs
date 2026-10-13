using System.Xml;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Uploads;
using Application.Interfaces.Services.Uploads;
using FluentValidation;
using FluentValidation.Results;

namespace Infrastructure.Implementations.Services.Uploads;

public sealed class UploadService(IImageInspector imageInspector, IFileStorage fileStorage) : IUploadService
{
    private const string FileField = "file";
    private const string ImageFolder = "images";

    public async Task<UploadedImage> UploadImageAsync(Stream content, long sizeBytes, CancellationToken ct = default)
    {
        if (sizeBytes <= 0)
            throw Invalid("Chưa chọn file ảnh.");
        if (sizeBytes > UploadLimits.MaxImageBytes)
            throw Invalid("Ảnh tối đa 2 MB.");

        // Đọc tối đa giới hạn + 1 byte để phát hiện file lớn hơn kích thước khai báo.
        using var buffer = new MemoryStream((int)sizeBytes);
        await CopyWithLimitAsync(content, buffer, UploadLimits.MaxImageBytes + 1, ct);
        if (buffer.Length > UploadLimits.MaxImageBytes)
            throw Invalid("Ảnh tối đa 2 MB.");

        var bytes = buffer.GetBuffer().AsMemory(0, (int)buffer.Length);
        var image = imageInspector.Inspect(bytes.Span)
            ?? throw Invalid("Chỉ nhận ảnh JPG, PNG, WebP hoặc SVG.");

        if (image.Format == ImageFormat.Svg && !IsSafeSvg(bytes))
            throw Invalid("Ảnh SVG chứa mã script hoặc liên kết ngoài, không được phép tải lên.");

        buffer.Position = 0;
        var url = await fileStorage.SaveAsync(buffer, ImageFolder, image.Extension, ct);
        return new UploadedImage
        {
            Url = url,
            Width = image.Width,
            Height = image.Height,
            SizeBytes = buffer.Length
        };
    }

    private static async Task CopyWithLimitAsync(Stream source, Stream destination, long limit, CancellationToken ct)
    {
        var chunk = new byte[81920];
        long total = 0;
        int read;
        while (total < limit && (read = await source.ReadAsync(chunk.AsMemory(0, (int)Math.Min(chunk.Length, limit - total)), ct)) > 0)
        {
            await destination.WriteAsync(chunk.AsMemory(0, read), ct);
            total += read;
        }
    }

    /// <summary>
    /// SVG có thể chứa script chạy khi mở trực tiếp. Từ chối thẻ script, foreignObject, thuộc tính sự kiện (on*),
    /// và liên kết không phải nội bộ (#…) hoặc ảnh nhúng (data:image/…).
    /// </summary>
    private static bool IsSafeSvg(ReadOnlyMemory<byte> content)
    {
        try
        {
            using var stream = new MemoryStream(content.ToArray(), writable: false);
            using var reader = XmlReader.Create(stream, SvgReaderSettings.Create());
            while (reader.Read())
            {
                if (reader.NodeType != XmlNodeType.Element)
                    continue;

                if (reader.LocalName.Equals("script", StringComparison.OrdinalIgnoreCase)
                    || reader.LocalName.Equals("foreignObject", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                if (!reader.MoveToFirstAttribute())
                    continue;

                do
                {
                    if (reader.LocalName.StartsWith("on", StringComparison.OrdinalIgnoreCase))
                        return false;

                    if (reader.LocalName.Equals("href", StringComparison.OrdinalIgnoreCase))
                    {
                        var value = reader.Value.Trim();
                        if (!value.StartsWith('#') && !value.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                            return false;
                    }
                }
                while (reader.MoveToNextAttribute());

                reader.MoveToElement();
            }

            return true;
        }
        catch (XmlException)
        {
            return false;
        }
    }

    private static ValidationException Invalid(string message) => new([new ValidationFailure(FileField, message)]);
}
