using Domain.Enums.System.AuditLogs;

namespace Application.DTOs.AuditLogs;

/// <summary>Một dòng nhật ký thao tác.</summary>
public sealed record AuditLogDto
{
    public Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string? Username { get; init; }

    /// <summary><c>Create</c> | <c>Update</c> | <c>Delete</c> | <c>Login</c>.</summary>
    public AuditAction Action { get; init; }

    /// <summary>Tên entity, vd <c>User</c>, <c>Role</c>, <c>Setting</c>.</summary>
    public string EntityName { get; init; } = string.Empty;

    public string? EntityId { get; init; }

    /// <summary>JSON các cột thay đổi, giá trị trước.</summary>
    public string? OldValues { get; init; }

    /// <summary>JSON các cột thay đổi, giá trị sau.</summary>
    public string? NewValues { get; init; }

    public string? IpAddress { get; init; }
    public DateTime CreatedAt { get; init; }
}
