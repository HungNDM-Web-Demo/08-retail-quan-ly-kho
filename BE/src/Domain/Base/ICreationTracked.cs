namespace Domain.Base;

/// <summary>Entity ghi lại người tạo. Interceptor tự điền từ token.</summary>
public interface ICreationTracked
{
    Guid? CreatedBy { get; set; }
}
