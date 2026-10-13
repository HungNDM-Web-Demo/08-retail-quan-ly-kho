namespace Domain.Base;

/// <summary>
/// Entity ghi rất nhiều và không cần dấu vết thao tác (vd sự kiện truy cập, số liệu tổng hợp theo ngày).
/// AuditSaveChangesInterceptor vẫn điền thời gian, người tạo/sửa nhưng không ghi <c>System_AuditLogs</c> cho entity này.
/// </summary>
public interface IAuditLogExempt
{
}
