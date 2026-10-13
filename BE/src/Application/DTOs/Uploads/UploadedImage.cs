namespace Application.DTOs.Uploads;

/// <summary>Ảnh đã tải lên.</summary>
public sealed record UploadedImage
{
    /// <summary>Đường dẫn tương đối, vd <c>/uploads/images/2026/10/abc.png</c>; FE ghép với địa chỉ API.</summary>
    public string Url { get; init; } = string.Empty;

    /// <summary>Chiều rộng (px); SVG không khai báo kích thước thì là 0.</summary>
    public int Width { get; init; }

    /// <summary>Chiều cao (px); SVG không khai báo kích thước thì là 0.</summary>
    public int Height { get; init; }

    public long SizeBytes { get; init; }
}
