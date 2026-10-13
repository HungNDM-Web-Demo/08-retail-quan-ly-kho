using System.Linq.Expressions;
using Domain.Base;

namespace Application.Interfaces.Repositories;

/// <summary>
/// Repository dùng chung cho mọi entity kế thừa <see cref="BaseEntity"/>. Lưu thay đổi qua <see cref="IUnitOfWork"/>.
/// Truy vấn phức tạp (báo cáo, join nhiều bảng) thì tạo repository riêng.
/// </summary>
public interface IGenericRepository<T>
    where T : BaseEntity
{
    /// <summary>Truy vấn có theo dõi thay đổi, dùng khi cần sửa entity đọc ra.</summary>
    IQueryable<T> Query();

    /// <summary>Truy vấn chỉ đọc (AsNoTracking), dùng cho danh sách, chi tiết.</summary>
    IQueryable<T> QueryNoTracking();

    Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);

    Task AddAsync(T entity, CancellationToken ct = default);

    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default);

    void Update(T entity);

    /// <summary>Xóa entity. Entity có <c>ISoftDelete</c> được interceptor đổi thành xóa mềm.</summary>
    void Delete(T entity);

    void DeleteRange(IEnumerable<T> entities);
}
