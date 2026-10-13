using System.Buffers.Binary;
using System.Globalization;
using System.Xml;
using Application.Common.Models;
using Application.Interfaces.Services.Uploads;

namespace Infrastructure.Implementations.Services.Uploads;

/// <summary>
/// Đọc định dạng và kích thước ảnh trực tiếp từ byte đầu file, không cần ImageSharp hay System.Drawing:
/// PNG (chunk IHDR), JPEG (segment SOFn), WebP (VP8, VP8L, VP8X), SVG (width/height hoặc viewBox của thẻ gốc).
/// Không xét hướng xoay EXIF của JPEG.
/// </summary>
public sealed class ImageInspector : IImageInspector
{
    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static ReadOnlySpan<byte> Utf8Bom => [0xEF, 0xBB, 0xBF];

    public ImageInfo? Inspect(ReadOnlySpan<byte> content)
    {
        if (content.StartsWith(PngSignature))
            return ReadPng(content);

        if (content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF)
            return ReadJpeg(content);

        if (content.Length >= 12 && content[..4].SequenceEqual("RIFF"u8) && content.Slice(8, 4).SequenceEqual("WEBP"u8))
            return ReadWebp(content);

        return ReadSvg(content);
    }

    private static ImageInfo? ReadPng(ReadOnlySpan<byte> content)
    {
        // 8 byte chữ ký, 4 byte độ dài, "IHDR", rộng 4 byte, cao 4 byte (big-endian).
        if (content.Length < 24 || !content.Slice(12, 4).SequenceEqual("IHDR"u8))
            return null;

        return Create(
            ImageFormat.Png,
            BinaryPrimitives.ReadUInt32BigEndian(content[16..]),
            BinaryPrimitives.ReadUInt32BigEndian(content[20..]));
    }

    private static ImageInfo? ReadJpeg(ReadOnlySpan<byte> content)
    {
        var offset = 2;
        while (offset + 4 <= content.Length)
        {
            if (content[offset] != 0xFF)
                return null;

            var marker = content[offset + 1];
            if (marker == 0xFF)
            {
                offset++; // Byte đệm.
                continue;
            }

            offset += 2;
            if (marker is 0x01 or 0xD8 or (>= 0xD0 and <= 0xD7))
                continue; // Marker không có độ dài.
            if (marker is 0xD9 or 0xDA)
                return null; // Hết ảnh hoặc bắt đầu dữ liệu nén mà chưa gặp SOF.

            var length = BinaryPrimitives.ReadUInt16BigEndian(content[offset..]);
            if (length < 2)
                return null;

            if (IsStartOfFrame(marker))
            {
                // Độ dài (2), độ chính xác (1), cao (2), rộng (2).
                if (offset + 7 > content.Length)
                    return null;

                return Create(
                    ImageFormat.Jpeg,
                    BinaryPrimitives.ReadUInt16BigEndian(content[(offset + 5)..]),
                    BinaryPrimitives.ReadUInt16BigEndian(content[(offset + 3)..]));
            }

            offset += length;
        }

        return null;
    }

    private static bool IsStartOfFrame(byte marker) =>
        marker is >= 0xC0 and <= 0xCF and not (0xC4 or 0xC8 or 0xCC);

    private static ImageInfo? ReadWebp(ReadOnlySpan<byte> content)
    {
        if (content.Length < 30)
            return null;

        var chunk = content.Slice(12, 4);
        if (chunk.SequenceEqual("VP8 "u8))
        {
            // Ảnh nén mất dữ liệu: mã bắt đầu khung 9D 01 2A, sau đó rộng và cao 14 bit (little-endian).
            if (content[23] != 0x9D || content[24] != 0x01 || content[25] != 0x2A)
                return null;

            return Create(
                ImageFormat.Webp,
                BinaryPrimitives.ReadUInt16LittleEndian(content[26..]) & 0x3FFFu,
                BinaryPrimitives.ReadUInt16LittleEndian(content[28..]) & 0x3FFFu);
        }

        if (chunk.SequenceEqual("VP8L"u8))
        {
            // Ảnh không mất dữ liệu: byte 0x2F, sau đó (rộng - 1) và (cao - 1) mỗi số 14 bit.
            if (content[20] != 0x2F)
                return null;

            uint b1 = content[21], b2 = content[22], b3 = content[23], b4 = content[24];
            var width = 1 + (((b2 & 0x3F) << 8) | b1);
            var height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
            return Create(ImageFormat.Webp, width, height);
        }

        if (chunk.SequenceEqual("VP8X"u8))
        {
            // Định dạng mở rộng: (rộng - 1) và (cao - 1) mỗi số 24 bit little-endian tại byte 24 và 27.
            var width = 1 + (content[24] | ((uint)content[25] << 8) | ((uint)content[26] << 16));
            var height = 1 + (content[27] | ((uint)content[28] << 8) | ((uint)content[29] << 16));
            return Create(ImageFormat.Webp, width, height);
        }

        return null;
    }

    private static ImageInfo? ReadSvg(ReadOnlySpan<byte> content)
    {
        if (!LooksLikeXml(content))
            return null;

        try
        {
            using var stream = new MemoryStream(content.ToArray(), writable: false);
            using var reader = XmlReader.Create(stream, SvgReaderSettings.Create());
            if (reader.MoveToContent() != XmlNodeType.Element || reader.LocalName != "svg")
                return null;

            var width = ParseLength(reader.GetAttribute("width"));
            var height = ParseLength(reader.GetAttribute("height"));
            if ((width is null || height is null) && TryParseViewBox(reader.GetAttribute("viewBox"), out var viewWidth, out var viewHeight))
            {
                width ??= viewWidth;
                height ??= viewHeight;
            }

            return new ImageInfo(ImageFormat.Svg, width ?? 0, height ?? 0);
        }
        catch (XmlException)
        {
            return null;
        }
    }

    /// <summary>Ký tự đầu tiên (bỏ BOM, khoảng trắng) phải là '&lt;' thì mới thử đọc như SVG.</summary>
    private static bool LooksLikeXml(ReadOnlySpan<byte> content)
    {
        if (content.StartsWith(Utf8Bom))
            content = content[3..];

        foreach (var b in content)
        {
            if (b is (byte)' ' or (byte)'\t' or (byte)'\r' or (byte)'\n')
                continue;
            return b == (byte)'<';
        }

        return false;
    }

    /// <summary>Đọc "120", "120px", "120.5"; bỏ qua đơn vị tương đối như "%", "em".</summary>
    private static int? ParseLength(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var text = value.Trim();
        if (text.EndsWith("px", StringComparison.OrdinalIgnoreCase))
            text = text[..^2];

        return double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) && number > 0
            ? (int)Math.Round(number)
            : null;
    }

    private static bool TryParseViewBox(string? value, out int width, out int height)
    {
        width = height = 0;
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var parts = value.Split([' ', ',', '\t', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 4
            || !double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out var w)
            || !double.TryParse(parts[3], NumberStyles.Float, CultureInfo.InvariantCulture, out var h)
            || w <= 0 || h <= 0)
        {
            return false;
        }

        width = (int)Math.Round(w);
        height = (int)Math.Round(h);
        return true;
    }

    private static ImageInfo? Create(ImageFormat format, uint width, uint height) =>
        width is > 0 and <= int.MaxValue && height is > 0 and <= int.MaxValue
            ? new ImageInfo(format, (int)width, (int)height)
            : null;
}
