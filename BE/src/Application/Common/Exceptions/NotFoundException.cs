namespace Application.Common.Exceptions;

/// <summary>Không tìm thấy bản ghi. ExceptionMiddleware trả 404 ProblemDetails.</summary>
public class NotFoundException : Exception
{
    public NotFoundException(string message)
        : base(message)
    {
    }
}
