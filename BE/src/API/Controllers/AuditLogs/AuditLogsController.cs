using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.AuditLogs;
using Application.Interfaces.Services.AuditLogs;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.AuditLogs;

/// <summary>Nhật ký thao tác (UC-SYS-08).</summary>
[Route("api/audit-logs")]
public sealed class AuditLogsController(IAuditLogService auditLogService) : BaseApiController
{
    /// <summary>Danh sách nhật ký, lọc theo người, đối tượng, hành động, khoảng thời gian.</summary>
    /// <remarks>
    /// <c>fromDate</c>/<c>toDate</c> chỉ ghi ngày (vd <c>2026-10-31</c>) thì hiểu theo giờ Việt Nam và <c>toDate</c> lấy hết ngày đó;
    /// có giờ kèm <c>Z</c> thì so đúng thời điểm UTC.
    /// </remarks>
    [HttpGet]
    [AuthorizePermission(Permissions.AuditLogs.View)]
    [ProducesResponseType<PaginatedResult<AuditLogDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<AuditLogDto>>> GetAll([FromQuery] AuditLogQuery query, CancellationToken ct) =>
        Ok(await auditLogService.GetPagedAsync(query, ct));
}
