using Infrastructure.Options;
using Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace API.Configuration;

public static class JwtAuthenticationSetup
{
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
            });

        services.AddAuthorization();

        return services;
    }
}
