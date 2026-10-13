namespace Application.Common.Exceptions;

/// <summary>
/// Trùng dữ liệu (mã, tên đăng nhập…). ExceptionMiddleware trả 409 ProblemDetails.
/// Khi có <see cref="Field"/> (tên trường camelCase), ProblemDetails kèm <c>errors</c> để FE gắn lỗi vào đúng ô nhập.
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message, string? field = null)
        : base(message)
    {
        Field = field;
    }

    public string? Field { get; }
}
