namespace Application.Interfaces.Repositories;

/// <summary>Điểm lưu thay đổi duy nhất của AppDbContext.</summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);

    /// <summary>
    /// Chạy <paramref name="action"/> trong một transaction: thành công thì commit, lỗi thì rollback.
    /// Bên trong vẫn gọi <see cref="SaveChangesAsync"/> như bình thường.
    /// </summary>
    Task ExecuteInTransactionAsync(Func<CancellationToken, Task> action, CancellationToken ct = default);
}
