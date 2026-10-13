using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Đặt lại dữ liệu demo (BR-SYS-09): trong một transaction, xóa dữ liệu nghiệp vụ rồi nạp lại bản mẫu.
/// Giữ nguyên tài khoản, vai trò, cài đặt, nhật ký. Dùng chung cho <c>POST /api/demo/reset</c> và DemoResetJob;
/// hai lần đặt lại không chạy chồng lên nhau.
/// </summary>
public sealed class DemoDataResetter(AppDbContext db, IDemoDataSeeder demoDataSeeder, ILogger<DemoDataResetter> logger)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task ResetAsync(CancellationToken ct = default)
    {
        await Gate.WaitAsync(ct);
        var previous = db.SuppressAuditLog;
        db.SuppressAuditLog = true;
        try
        {
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await db.Database.BeginTransactionAsync(ct);
                await demoDataSeeder.ClearAsync(ct);
                db.ChangeTracker.Clear();
                await demoDataSeeder.SeedAsync(ct);
                await transaction.CommitAsync(ct);
            });

            logger.LogInformation("Đã đặt lại dữ liệu demo.");
        }
        finally
        {
            db.ChangeTracker.Clear();
            db.SuppressAuditLog = previous;
            Gate.Release();
        }
    }
}
