using Microsoft.AspNetCore.HttpOverrides;

namespace API.Configuration;

public static class ForwardedHeadersSetup
{
    /// <summary>
    /// Khi chạy sau reverse proxy (Dokploy/Traefik, Caddy, Nginx) với <c>BEHIND_PROXY=true</c>: đọc
    /// <c>X-Forwarded-For</c>, <c>X-Forwarded-Proto</c> để IP khách và scheme (https) đúng như người dùng thấy.
    /// Proxy nằm ngoài container nên không biết trước IP: xóa danh sách KnownProxies/KnownNetworks. Vì vậy chỉ bật
    /// khi cổng của API không mở thẳng ra Internet (compose chỉ bind 127.0.0.1, Dokploy đi qua Traefik).
    /// Không gọi UseHttpsRedirection: HTTPS do proxy lo, container chỉ nghe http.
    /// </summary>
    public static WebApplication UseReverseProxySupport(this WebApplication app)
    {
        if (!app.Configuration.GetValue<bool>("BehindProxy"))
            return app;

        var options = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
        };
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();

        app.UseForwardedHeaders(options);
        return app;
    }
}
