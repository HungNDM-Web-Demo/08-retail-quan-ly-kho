namespace Application.Common.Exceptions;

/// <summary>Đã đăng nhập nhưng không đủ quyền. ExceptionMiddleware trả 403 ProblemDetails.</summary>
public class ForbiddenException : Exception
{
    public ForbiddenException(string message)
        : base(message)
    {
    }
}
