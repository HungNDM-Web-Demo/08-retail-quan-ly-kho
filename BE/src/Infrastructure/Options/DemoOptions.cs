using Cronos;

namespace Infrastructure.Options;

/// <summary>Cấu hình chế độ demo, nạp từ <c>DEMO_MODE</c>, <c>DEMO_PASSWORD</c>, <c>DEMO_RESET_CRON</c>.</summary>
public sealed class DemoOptions
{
    public const string SectionName = "Demo";

    /// <summary>Bật API <c>/api/demo/*</c>, nạp dữ liệu mẫu nghiệp vụ khi DB trống, chạy DemoResetJob.</summary>
    public bool Enabled { get; set; }

    /// <summary>Mật khẩu chung của các tài khoản demo trong file seed.</summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>Lịch cron 5 trường theo giờ Việt Nam, vd <c>0 3 * * *</c>; để trống là tắt.</summary>
    public string? ResetCron { get; set; }

    public bool HasValidResetCron()
    {
        if (string.IsNullOrWhiteSpace(ResetCron))
            return true;

        try
        {
            CronExpression.Parse(ResetCron.Trim());
            return true;
        }
        catch (CronFormatException)
        {
            return false;
        }
    }
}
