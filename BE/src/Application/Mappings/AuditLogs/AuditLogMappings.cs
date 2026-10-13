using Application.DTOs.AuditLogs;
using Domain.Entities.System.AuditLogs;

namespace Application.Mappings.AuditLogs;

/// <summary>Ánh xạ viết tay cho nhật ký thao tác.</summary>
public static class AuditLogMappings
{
    public static AuditLogDto ToDto(this AuditLog log) => new()
    {
        Id = log.Id,
        UserId = log.UserId,
        Username = log.Username,
        Action = log.Action,
        EntityName = log.EntityName,
        EntityId = log.EntityId,
        OldValues = log.OldValues,
        NewValues = log.NewValues,
        IpAddress = log.IpAddress,
        CreatedAt = log.CreatedAt
    };
}
