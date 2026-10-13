using Domain.Base;
using Domain.Enums.System.AuditLogs;

namespace Domain.Entities.System.AuditLogs;

/// <summary>
/// Nhật ký thao tác (<c>System_AuditLogs</c>). Create/Update/Delete do AuditSaveChangesInterceptor ghi tự động;
/// Login do dịch vụ đăng nhập ghi.
/// </summary>
public class AuditLog : BaseEntity
{
    public const int UsernameMaxLength = 50;
    public const int EntityNameMaxLength = 100;
    public const int EntityIdMaxLength = 100;
    public const int IpAddressMaxLength = 50;

    private AuditLog()
    {
    }

    public Guid? UserId { get; private set; }

    /// <summary>Tên đăng nhập tại thời điểm thao tác (giữ lại kể cả khi tài khoản bị xóa).</summary>
    public string? Username { get; private set; }

    public AuditAction Action { get; private set; }
    public string EntityName { get; private set; } = string.Empty;
    public string? EntityId { get; private set; }

    /// <summary>JSON các cột trước khi đổi.</summary>
    public string? OldValues { get; private set; }

    /// <summary>JSON các cột sau khi đổi.</summary>
    public string? NewValues { get; private set; }

    public string? IpAddress { get; private set; }

    public static AuditLog Create(
        AuditAction action,
        string entityName,
        string? entityId,
        Guid? userId,
        string? username,
        string? ipAddress,
        string? oldValues = null,
        string? newValues = null) =>
        new()
        {
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            UserId = userId,
            Username = username,
            IpAddress = ipAddress,
            OldValues = oldValues,
            NewValues = newValues
        };
}
