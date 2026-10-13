using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.AuditLogs;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.AuditLogs;
using Application.Mappings.AuditLogs;
using Domain.Entities.System.AuditLogs;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.AuditLogs;

public sealed class AuditLogService(IGenericRepository<AuditLog> auditLogs) : IAuditLogService
{
    public async Task<PaginatedResult<AuditLogDto>> GetPagedAsync(AuditLogQuery query, CancellationToken ct = default)
    {
        var source = auditLogs.QueryNoTracking();

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(a =>
                AppDbFunctions.Matches(a.Username, pattern)
                || AppDbFunctions.Matches(a.EntityName, pattern)
                || AppDbFunctions.Matches(a.EntityId, pattern));
        }

        if (query.UserId is { } userId)
            source = source.Where(a => a.UserId == userId);

        if (!string.IsNullOrWhiteSpace(query.EntityName))
        {
            var entityName = query.EntityName.Trim();
            source = source.Where(a => a.EntityName == entityName);
        }

        if (query.Action is { } action)
            source = source.Where(a => a.Action == action);

        if (query.FromDate is { } fromDate)
        {
            var fromUtc = VietnamTime.ToUtc(fromDate);
            source = source.Where(a => a.CreatedAt >= fromUtc);
        }

        if (query.ToDate is { } toDate)
        {
            // Chỉ ghi ngày (không giờ, không múi giờ) thì lấy hết ngày đó theo giờ Việt Nam.
            if (toDate.Kind == DateTimeKind.Unspecified && toDate.TimeOfDay == TimeSpan.Zero)
            {
                var toExclusiveUtc = VietnamTime.ToUtc(toDate.AddDays(1));
                source = source.Where(a => a.CreatedAt < toExclusiveUtc);
            }
            else
            {
                var toUtc = VietnamTime.ToUtc(toDate);
                source = source.Where(a => a.CreatedAt <= toUtc);
            }
        }

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(a => a.ToDto()).ToList());
    }
}
