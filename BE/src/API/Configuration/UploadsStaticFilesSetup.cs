using Infrastructure.Options;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace API.Configuration;

public static class UploadsStaticFilesSetup
{
    private const int CacheSeconds = 7 * 24 * 60 * 60;

    /// <summary>
    /// Phục vụ file tải lên ở <c>/uploads</c> (không cần đăng nhập). Gửi kèm header chặn chạy script để file SVG
    /// mở trực tiếp cũng an toàn.
    /// </summary>
    public static WebApplication UseUploadsStaticFiles(this WebApplication app)
    {
        var storage = app.Services.GetRequiredService<IOptions<FileStorageOptions>>().Value;
        Directory.CreateDirectory(storage.RootPath);

        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(storage.RootPath),
            RequestPath = storage.RequestPath,
            OnPrepareResponse = context =>
            {
                var headers = context.Context.Response.Headers;
                headers.XContentTypeOptions = "nosniff";
                headers.ContentSecurityPolicy = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
                headers.CacheControl = $"public, max-age={CacheSeconds}";
            }
        });

        return app;
    }
}
