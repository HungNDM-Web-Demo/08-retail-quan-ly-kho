namespace Domain.Base;

/// <summary>
/// Lớp gốc của mọi entity: khóa Guid sinh ở code, thời gian tạo/sửa lưu UTC.
/// <see cref="CreatedAt"/> và <see cref="UpdatedAt"/> do AuditSaveChangesInterceptor tự điền, không gán tay.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();

    public DateTime CreatedAt { get; protected set; }

    public DateTime? UpdatedAt { get; protected set; }
}
