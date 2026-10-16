using Application.Common.Exceptions;
using Application.Interfaces.Repositories;
using Domain.Entities.Inventory;
using Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Infrastructure.Implementations.Services.Inventory;

/// <summary>
/// Hiện thực <see cref="IInventoryTransaction"/> (repository riêng của nghiệp vụ kho, cần <see cref="AppDbContext"/> để
/// bỏ thay đổi, khóa dòng). Thử lại đúng một lần khi tranh chấp phiên bản hoặc trùng khóa unique (NFR-03, 06 §3).
/// </summary>
public sealed class InventoryTransaction(AppDbContext context) : IInventoryTransaction
{
    public async Task<T> RunAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct = default)
    {
        if (context.Database.CurrentTransaction is not null)
            return await action(ct);

        for (var attempt = 1; ; attempt++)
        {
            context.ChangeTracker.Clear();
            try
            {
                var strategy = context.Database.CreateExecutionStrategy();
                return await strategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await context.Database.BeginTransactionAsync(ct);
                    var result = await action(ct);
                    await transaction.CommitAsync(ct);
                    return result;
                });
            }
            catch (DbUpdateConcurrencyException) when (attempt == 1)
            {
            }
            catch (DbUpdateException ex) when (attempt == 1 && IsUniqueViolation(ex))
            {
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // 07 §2.12: 409 DuLieuCu kèm currentVersion của phiếu (đọc lại từ CSDL nếu bản ghi tranh chấp là phiếu)
                var currentVersion = await CurrentVersionAsync(ex, ct);
                context.ChangeTracker.Clear();
                throw new ConflictException(InventoryErrors.StaleMessage, null,
                    new Dictionary<string, object?> { ["code"] = InventoryErrors.DuLieuCu, ["currentVersion"] = currentVersion });
            }
            catch
            {
                context.ChangeTracker.Clear();
                throw;
            }
        }
    }

    public async Task LockWarehouseAsync(Guid warehouseId, CancellationToken ct = default)
    {
        if (!context.Database.IsNpgsql() || context.Database.CurrentTransaction is null)
            return;

        await context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT 1 FROM \"Inventory_Warehouses\" WHERE \"Id\" = {warehouseId} FOR UPDATE", ct);
    }

    private static async Task<int?> CurrentVersionAsync(DbUpdateConcurrencyException ex, CancellationToken ct)
    {
        foreach (var entry in ex.Entries)
        {
            if (entry.Metadata.FindProperty("Version") is null)
                continue;
            try
            {
                var values = await entry.GetDatabaseValuesAsync(ct);
                if (values?["Version"] is int version)
                    return version;
            }
            catch (Exception e) when (e is InvalidOperationException or System.Data.Common.DbException)
            {
                // Giao dịch đã hủy: bỏ qua, trả null
            }
        }

        return null;
    }

    private static bool IsUniqueViolation(DbUpdateException ex) => ex.InnerException switch
    {
        PostgresException pg => pg.SqlState == PostgresErrorCodes.UniqueViolation,
        SqliteException sqlite => sqlite.SqliteErrorCode == 19,
        _ => false
    };
}
