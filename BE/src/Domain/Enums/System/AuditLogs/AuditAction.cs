namespace Domain.Enums.System.AuditLogs;

/// <summary>Loại thao tác ghi vào nhật ký. Lưu dạng chuỗi trong cột <c>System_AuditLogs.Action</c>.</summary>
public enum AuditAction
{
    Create,
    Update,
    Delete,
    Login
}
