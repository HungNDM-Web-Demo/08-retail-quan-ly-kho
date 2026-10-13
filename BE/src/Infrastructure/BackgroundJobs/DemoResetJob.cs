using Application.Common.Time;
using Cronos;
using Infrastructure.Options;
using Infrastructure.Persistence.Seeders;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.BackgroundJobs;

/// <summary>
/// Tự đặt lại dữ liệu demo theo lịch <c>DEMO_RESET_CRON</c> (cron 5 trường, giờ Việt Nam), FR-SYS-13, BR-SYS-09.
/// Chỉ chạy khi <c>DEMO_MODE=true</c> và có lịch.
/// </summary>
public sealed class DemoResetJob(
    IServiceScopeFactory scopeFactory,
    IOptions<DemoOptions> demoOptions,
    TimeProvider timeProvider,
    ILogger<DemoResetJob> logger) : BackgroundService
{
    // Task.Delay chỉ chờ được khoảng 49 ngày; chờ từng đoạn ngắn rồi tính lại.
    private static readonly TimeSpan MaxDelay = TimeSpan.FromHours(12);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = demoOptions.Value;
        if (!options.Enabled || string.IsNullOrWhiteSpace(options.ResetCron))
            return;

        var schedule = CronExpression.Parse(options.ResetCron.Trim());
        logger.LogInformation("Bật tự đặt lại dữ liệu demo theo lịch \"{Cron}\" (giờ Việt Nam).", options.ResetCron);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var next = schedule.GetNextOccurrence(timeProvider.GetUtcNow(), VietnamTime.Zone);
                if (next is null)
                    return;

                logger.LogInformation(
                    "Lần đặt lại dữ liệu demo tiếp theo: {Next:dd/MM/yyyy HH:mm} (giờ Việt Nam).",
                    TimeZoneInfo.ConvertTime(next.Value, VietnamTime.Zone));

                await WaitUntilAsync(next.Value, stoppingToken);
                await ResetAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Ứng dụng đang dừng.
        }
    }

    private async Task WaitUntilAsync(DateTimeOffset dueTime, CancellationToken ct)
    {
        while (true)
        {
            var remaining = dueTime - timeProvider.GetUtcNow();
            if (remaining <= TimeSpan.Zero)
                return;

            await Task.Delay(remaining < MaxDelay ? remaining : MaxDelay, timeProvider, ct);
        }
    }

    private async Task ResetAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<DemoDataResetter>().ResetAsync(ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Đặt lại dữ liệu demo theo lịch thất bại.");
        }
    }
}
