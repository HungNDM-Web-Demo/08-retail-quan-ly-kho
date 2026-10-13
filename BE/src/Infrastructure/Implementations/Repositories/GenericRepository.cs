using System.Linq.Expressions;
using Application.Interfaces.Repositories;
using Domain.Base;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Repositories;

public class GenericRepository<T>(AppDbContext context) : IGenericRepository<T>
    where T : BaseEntity
{
    protected AppDbContext Context { get; } = context;

    protected DbSet<T> Set => Context.Set<T>();

    public IQueryable<T> Query() => Set;

    public IQueryable<T> QueryNoTracking() => Set.AsNoTracking();

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await Set.FindAsync([id], ct);

    public Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) =>
        Set.AnyAsync(predicate, ct);

    public async Task AddAsync(T entity, CancellationToken ct = default) =>
        await Set.AddAsync(entity, ct);

    public Task AddRangeAsync(IEnumerable<T> entities, CancellationToken ct = default) =>
        Set.AddRangeAsync(entities, ct);

    public void Update(T entity) => Set.Update(entity);

    public void Delete(T entity) => Set.Remove(entity);

    public void DeleteRange(IEnumerable<T> entities) => Set.RemoveRange(entities);
}
