using Application.Common.Models;

namespace Application.Interfaces.Services.Common;

/// <summary>
/// Hợp đồng CRUD chuẩn có bộ lọc riêng <typeparamref name="TQuery"/> (kế thừa <see cref="PaginationQuery"/>).
/// Luồng: Controller → service này → repository.
/// </summary>
public interface ICrudService<TDto, in TCreate, in TUpdate, in TQuery>
    where TQuery : PaginationQuery
{
    Task<PaginatedResult<TDto>> GetPagedAsync(TQuery query, CancellationToken ct = default);

    Task<TDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<TDto> CreateAsync(TCreate request, CancellationToken ct = default);

    Task<TDto> UpdateAsync(Guid id, TUpdate request, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Hợp đồng CRUD chuẩn, danh sách chỉ dùng query chung (page, pageSize, search, sortBy, sortDir).</summary>
public interface ICrudService<TDto, in TCreate, in TUpdate> : ICrudService<TDto, TCreate, TUpdate, PaginationQuery>
{
}
