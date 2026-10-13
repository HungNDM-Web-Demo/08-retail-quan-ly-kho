namespace Application.Interfaces.Services.Uploads;

/// <summary>Lưu file tải lên. Bản mặc định lưu vào <c>wwwroot/uploads</c> và phục vụ tĩnh ở <c>/uploads</c>.</summary>
public interface IFileStorage
{
    /// <summary>
    /// Lưu nội dung vào thư mục con <paramref name="folder"/> (vd <c>images</c>) với tên ngẫu nhiên.
    /// Trả đường dẫn tương đối, vd <c>/uploads/images/2026/10/3f2a….png</c>.
    /// </summary>
    Task<string> SaveAsync(Stream content, string folder, string extension, CancellationToken ct = default);

    /// <summary>Xóa file theo đường dẫn tương đối đã trả từ <see cref="SaveAsync"/>; không có thì bỏ qua.</summary>
    Task DeleteAsync(string relativeUrl, CancellationToken ct = default);
}
