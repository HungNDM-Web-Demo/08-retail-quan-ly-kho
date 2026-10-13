namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Nạp và xóa dữ liệu nghiệp vụ mẫu (KIEN-TRUC-HE-THONG §8). Không đụng tới bảng <c>System_*</c>.
/// Khi chạy, nhật ký thao tác đã được tắt (<see cref="AppDbContext.SuppressAuditLog"/>).
/// </summary>
public interface IDemoDataSeeder
{
    /// <summary>DB đã có dữ liệu nghiệp vụ chưa. Khởi động với <c>DEMO_MODE=true</c> chỉ seed khi trả false.</summary>
    Task<bool> HasDataAsync(CancellationToken ct = default);

    /// <summary>Nạp dữ liệu mẫu, ngày tháng tính lại theo hôm nay.</summary>
    Task SeedAsync(CancellationToken ct = default);

    /// <summary>Xóa toàn bộ dữ liệu nghiệp vụ (bảng con trước, bảng cha sau). Chạy trong transaction của DemoDataResetter.</summary>
    Task ClearAsync(CancellationToken ct = default);
}
