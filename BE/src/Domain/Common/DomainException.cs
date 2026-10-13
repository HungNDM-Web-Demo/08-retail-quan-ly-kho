namespace Domain.Common;

/// <summary>
/// Vi phạm quy tắc nghiệp vụ. ExceptionMiddleware trả 400 ProblemDetails, <c>detail</c> là <see cref="Exception.Message"/>.
/// <see cref="Extensions"/> được đưa thành trường mở rộng của ProblemDetails, vd <c>"missing": ["..."]</c>.
/// </summary>
public class DomainException : Exception
{
    public DomainException(string message)
        : this(message, null)
    {
    }

    public DomainException(string message, IReadOnlyDictionary<string, object?>? extensions)
        : base(message)
    {
        Extensions = extensions ?? new Dictionary<string, object?>();
    }

    public IReadOnlyDictionary<string, object?> Extensions { get; }
}
