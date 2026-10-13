using Application.DTOs.Uploads;

namespace Application.Interfaces.Services.Uploads;

/// <summary>Nhận file tải lên, kiểm tra và lưu.</summary>
public interface IUploadService
{
    /// <summary>
    /// Lưu ảnh JPG/PNG/WebP/SVG tối đa 2 MB. Định dạng nhận diện theo nội dung file, không theo tên file.
    /// Sai định dạng hoặc quá dung lượng thì ném lỗi validate cho trường <c>file</c>.
    /// </summary>
    Task<UploadedImage> UploadImageAsync(Stream content, long sizeBytes, CancellationToken ct = default);
}
