namespace Domain.Base;

/// <summary>Entity ghi lại người sửa gần nhất. Interceptor tự điền từ token.</summary>
public interface IModificationTracked
{
    Guid? UpdatedBy { get; set; }
}
