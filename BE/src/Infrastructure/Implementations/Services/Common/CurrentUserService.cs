using System.Security.Claims;
using Application.Interfaces.Services.Common;
using Infrastructure.Security;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.Implementations.Services.Common;

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private HttpContext? HttpContext => httpContextAccessor.HttpContext;

    private ClaimsPrincipal? Principal => HttpContext?.User;

    public Guid? UserId => ParseGuid(Principal?.FindFirst(AppClaimTypes.Subject)?.Value);

    public string? Username => Principal?.FindFirst(AppClaimTypes.Name)?.Value;

    public Guid? SessionId => ParseGuid(Principal?.FindFirst(AppClaimTypes.SessionId)?.Value);

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public string? IpAddress
    {
        get
        {
            var address = HttpContext?.Connection.RemoteIpAddress;
            if (address is null)
                return null;

            return (address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address).ToString();
        }
    }

    private static Guid? ParseGuid(string? value) => Guid.TryParse(value, out var id) ? id : null;
}
