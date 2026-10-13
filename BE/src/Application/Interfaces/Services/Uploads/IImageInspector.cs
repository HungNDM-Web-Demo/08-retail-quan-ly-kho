using Application.Common.Models;

namespace Application.Interfaces.Services.Uploads;

/// <summary>
/// Nhận diện định dạng và kích thước ảnh từ nội dung file, không cần thư viện xử lý ảnh.
/// PNG, JPEG, WebP đọc từ header; SVG đọc thuộc tính width/height hoặc viewBox của thẻ gốc.
/// </summary>
public interface IImageInspector
{
    /// <summary>Trả null khi nội dung không phải ảnh hỗ trợ hoặc header hỏng.</summary>
    ImageInfo? Inspect(ReadOnlySpan<byte> content);
}
