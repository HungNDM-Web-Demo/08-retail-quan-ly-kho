using API.Base;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace API.Controllers.Health;

/// <summary>Kiểm tra API còn chạy và kết nối được CSDL.</summary>
[Route("api/health")]
[AllowAnonymous]
public sealed class HealthController(HealthCheckService healthCheckService, TimeProvider timeProvider) : BaseApiController
{
    /// <summary>Trạng thái API và CSDL. Trả 503 khi có thành phần lỗi.</summary>
    [HttpGet]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken ct)
    {
        var report = await healthCheckService.CheckHealthAsync(ct);
        var response = new HealthResponse(
            report.Status.ToString(),
            report.Entries.ToDictionary(e => e.Key, e => e.Value.Status.ToString()),
            timeProvider.GetUtcNow().UtcDateTime);

        return report.Status == HealthStatus.Healthy
            ? Ok(response)
            : StatusCode(StatusCodes.Status503ServiceUnavailable, response);
    }
}
