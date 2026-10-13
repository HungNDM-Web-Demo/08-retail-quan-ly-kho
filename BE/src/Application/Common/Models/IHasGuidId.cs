namespace Application.Common.Models;

/// <summary>DTO có khóa Guid; CrudApiController dùng để tạo header Location khi trả 201.</summary>
public interface IHasGuidId
{
    Guid Id { get; }
}
