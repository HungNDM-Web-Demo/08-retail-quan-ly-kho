using Application.Interfaces.Repositories;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Repositories;

public sealed class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken ct = default) => context.SaveChangesAsync(ct);

    public async Task ExecuteInTransactionAsync(Func<CancellationToken, Task> action, CancellationToken ct = default)
    {
        // Đang ở trong transaction (gọi lồng) thì chạy luôn, để transaction ngoài quyết định commit.
        if (context.Database.CurrentTransaction is not null)
        {
            await action(ct);
            return;
        }

        var strategy = context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await context.Database.BeginTransactionAsync(ct);
            await action(ct);
            await transaction.CommitAsync(ct);
        });
    }
}
