using Application.Common.Models;
using Application.DTOs.AuditLogs;

namespace Application.Interfaces.Services.AuditLogs;

/// <summary>Xem nhật ký thao tác (UC-SYS-08).</summary>
public interface IAuditLogService
{
    Task<PaginatedResult<AuditLogDto>> GetPagedAsync(AuditLogQuery query, CancellationToken ct = default);
}
