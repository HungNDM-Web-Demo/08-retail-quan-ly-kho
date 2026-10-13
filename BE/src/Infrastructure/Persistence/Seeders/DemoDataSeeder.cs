namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu nghiệp vụ mẫu của dự án. Trong _template chưa có bảng nghiệp vụ nên để trống;
/// mỗi chức năng mới thêm dữ liệu vào đây (BE-CAU-TRUC-THU-MUC §3 bước 11).
/// </summary>
/// <remarks>
/// Dữ liệu chỉ có một nguồn là FE/src/mock/seed/*.json, đọc bằng <see cref="SeedJson"/>. Trường ngày trong JSON ghi
/// tương đối, vd <c>"orderedAt": "daysAgo:3@09:30"</c>, tự đổi sang UTC theo hôm nay (xem <see cref="SeedDates"/>).
/// Ví dụ với chức năng đơn hàng:
/// <code>
/// public sealed class DemoDataSeeder(AppDbContext db, TimeProvider timeProvider) : IDemoDataSeeder
/// {
///     public Task&lt;bool&gt; HasDataAsync(CancellationToken ct = default) =&gt; db.Set&lt;Order&gt;().AnyAsync(ct);
///
///     public async Task SeedAsync(CancellationToken ct = default)
///     {
///         // OrderSeed(string Code, decimal Total, DateTime OrderedAt) khớp FE/src/mock/seed/orders.json
///         var orders = SeedJson.Read&lt;List&lt;OrderSeed&gt;&gt;("orders.json", timeProvider);
///         foreach (var x in orders)
///         {
///             var order = Order.Create(x.Code, x.Total, x.OrderedAt);
///             db.Add(order);
///             // Gán sẵn CreatedAt lùi ngày để danh sách sắp theo ngày tạo trông như thật; interceptor giữ nguyên giá trị này.
///             db.Entry(order).Property(e =&gt; e.CreatedAt).CurrentValue = x.OrderedAt;
///         }
///         await db.SaveChangesAsync(ct);
///     }
///
///     public async Task ClearAsync(CancellationToken ct = default)
///     {
///         // Bảng con trước, bảng cha sau. ExecuteDelete xóa cứng, IgnoreQueryFilters để xóa cả bản ghi đã xóa mềm.
///         await db.Set&lt;OrderItem&gt;().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
///         await db.Set&lt;Order&gt;().IgnoreQueryFilters().ExecuteDeleteAsync(ct);
///     }
/// }
/// </code>
/// </remarks>
public sealed class DemoDataSeeder : IDemoDataSeeder
{
    public Task<bool> HasDataAsync(CancellationToken ct = default) => Task.FromResult(false);

    public Task SeedAsync(CancellationToken ct = default) => Task.CompletedTask;

    public Task ClearAsync(CancellationToken ct = default) => Task.CompletedTask;
}
