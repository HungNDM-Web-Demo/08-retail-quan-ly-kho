using Application.Common.Models;
using Domain.Enums.System.AuditLogs;

namespace Application.DTOs.AuditLogs;

/// <summary>
/// Bộ lọc nhật ký. <c>search</c> tìm theo tên đăng nhập, tên entity, id entity.
/// Ngày giờ có <c>Z</c> hoặc độ lệch múi giờ thì giữ nguyên; chỉ ghi ngày (vd <c>2026-10-31</c>) thì hiểu theo giờ Việt Nam
/// và <c>toDate</c> lấy hết ngày đó.
/// </summary>
public sealed class AuditLogQuery : PaginationQuery
{
    public Guid? UserId { get; set; }

    /// <summary>Tên entity, vd <c>User</c>.</summary>
    public string? EntityName { get; set; }

    public AuditAction? Action { get; set; }

    public DateTime? FromDate { get; set; }

    public DateTime? ToDate { get; set; }
}
