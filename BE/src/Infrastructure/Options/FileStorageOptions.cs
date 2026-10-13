namespace Infrastructure.Options;

/// <summary>Nơi lưu file tải lên. Mặc định <c>{ContentRoot}/wwwroot/uploads</c>, phục vụ tĩnh ở <c>/uploads</c>.</summary>
public sealed class FileStorageOptions
{
    public const string DefaultRequestPath = "/uploads";

    /// <summary>Thư mục vật lý.</summary>
    public string RootPath { get; set; } = string.Empty;

    /// <summary>Tiền tố URL trả cho FE.</summary>
    public string RequestPath { get; set; } = DefaultRequestPath;
}
