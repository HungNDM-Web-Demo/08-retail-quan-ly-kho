namespace Application.Common.Models;

/// <summary>Định dạng và kích thước điểm ảnh của một ảnh. Với SVG, kích thước lấy từ width/height hoặc viewBox (0 nếu không có).</summary>
public sealed record ImageInfo(ImageFormat Format, int Width, int Height)
{
    /// <summary>Phần mở rộng dùng khi lưu file, không có dấu chấm.</summary>
    public string Extension => Format switch
    {
        ImageFormat.Png => "png",
        ImageFormat.Jpeg => "jpg",
        ImageFormat.Webp => "webp",
        ImageFormat.Svg => "svg",
        _ => throw new ArgumentOutOfRangeException(nameof(Format), Format, null)
    };
}
