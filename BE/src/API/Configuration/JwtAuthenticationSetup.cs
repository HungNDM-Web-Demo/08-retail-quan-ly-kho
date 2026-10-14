using Infrastructure.Options;
using Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace API.Configuration;

public static class JwtAuthenticationSetup
{
    /// <summary>Tiền tố đường dẫn SignalR hub nhận token qua query <c>access_token</c>.</summary>
    public const string HubsPathPrefix = "/hubs";

    /// <summary>
    /// Xác thực bằng JWT Bearer (khóa, issuer, audience lấy từ .env). Yêu cầu đăng nhập đặt ở BaseApiController
    /// (<c>[Authorize]</c>), không dùng FallbackPolicy để đường dẫn không tồn tại vẫn trả 404 thay vì 401.
    /// </summary>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();

        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((options, jwtOptions) =>
            {
                var jwt = jwtOptions.Value;

                // Giữ nguyên tên claim gốc (sub, name, roles…), không đổi sang tên dài của .NET.
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = jwt.CreateSigningKey(),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    NameClaimType = AppClaimTypes.Name,
                    RoleClaimType = AppClaimTypes.Roles
                };

                // SignalR: WebSocket/SSE không gửi được header Authorization nên token đi qua query access_token (chỉ cho /hubs).
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var token = context.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments(HubsPathPrefix))
                            context.Token = token;
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization();

        return services;
    }
}
