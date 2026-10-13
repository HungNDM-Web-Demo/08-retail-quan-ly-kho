using Infrastructure.Persistence;

namespace Infrastructure.Extensions;

/// <summary>
/// Hàm DB dùng trong LINQ, được <see cref="AppDbContext"/> dịch sang SQL của từng provider (không gọi được ngoài truy vấn EF).
/// </summary>
public static class AppDbFunctions
{
    /// <summary>
    /// Tìm chuỗi không phân biệt hoa thường theo mẫu LIKE (<c>%</c>, <c>_</c>, ký tự thoát <c>\</c>), mẫu tạo bằng
    /// <see cref="LikePattern"/>. Dịch theo provider:
    /// <list type="bullet">
    /// <item>Postgres: <c>lower(unaccent(value)) LIKE lower(unaccent(pattern)) ESCAPE '\'</c>, nên tìm "nguyen" khớp "Nguyễn"
    /// (cần extension <c>unaccent</c>, migration đầu đã bật).</item>
    /// <item>SQL Server: <c>value LIKE pattern ESCAPE '\'</c>, không phân biệt hoa thường theo collation (mặc định CI_AS).</item>
    /// <item>SQLite: <c>value LIKE pattern ESCAPE '\'</c>, chỉ không phân biệt hoa thường với chữ không dấu.</item>
    /// </list>
    /// <paramref name="value"/> null thì không khớp.
    /// </summary>
    /// <example>
    /// <code>
    /// var pattern = LikePattern.Contains(term);
    /// query = query.Where(x => AppDbFunctions.Matches(x.Name, pattern) || AppDbFunctions.Matches(x.Code, pattern));
    /// </code>
    /// </example>
    public static bool Matches(string? value, string pattern) =>
        throw new InvalidOperationException($"{nameof(AppDbFunctions)}.{nameof(Matches)} chỉ dùng trong truy vấn EF Core (dịch sang SQL).");
}
