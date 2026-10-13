namespace Application.Constants;

/// <summary>Giới hạn tải file lên (QUY-UOC-API §3.4).</summary>
public static class UploadLimits
{
    /// <summary>Ảnh tối đa 2 MB.</summary>
    public const long MaxImageBytes = 2 * 1024 * 1024;

    /// <summary>Giới hạn cả request multipart: ảnh tối đa cộng phần đầu multipart.</summary>
    public const long MaxImageRequestBytes = MaxImageBytes + 64 * 1024;
}
