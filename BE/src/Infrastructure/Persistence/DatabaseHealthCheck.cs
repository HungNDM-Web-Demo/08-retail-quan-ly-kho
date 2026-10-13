using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Persistence;

/// <summary>Kiểm tra kết nối CSDL cho <c>GET /api/health</c>.</summary>
public sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        await db.Database.CanConnectAsync(cancellationToken)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("Không kết nối được CSDL.");
}
