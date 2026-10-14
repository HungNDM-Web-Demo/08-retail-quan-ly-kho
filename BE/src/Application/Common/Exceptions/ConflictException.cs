namespace Application.Common.Exceptions;

/// <summary>
/// Trùng dữ liệu (mã, tên đăng nhập…) hoặc xung đột trạng thái. ExceptionMiddleware trả 409 ProblemDetails.
/// Khi có <see cref="Field"/> (tên trường camelCase), ProblemDetails kèm <c>errors</c> để FE gắn lỗi vào đúng ô nhập.
/// <see cref="Extensions"/> được đưa thành trường mở rộng của ProblemDetails (vd <c>serverTotal</c> khi tổng tiền đã đổi).
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message, string? field = null)
        : this(message, field, null)
    {
    }

    public ConflictException(string message, string? field, IReadOnlyDictionary<string, object?>? extensions)
        : base(message)
    {
        Field = field;
        Extensions = extensions ?? new Dictionary<string, object?>();
    }

    public string? Field { get; }

    public IReadOnlyDictionary<string, object?> Extensions { get; }
}
