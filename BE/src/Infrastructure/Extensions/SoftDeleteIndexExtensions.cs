using Domain.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Extensions;

/// <summary>
/// Index unique trên bảng xóa mềm (<see cref="ISoftDelete"/>) chỉ tính bản ghi chưa xóa, để bản ghi đã xóa không giữ chỗ mã.
/// Cú pháp filter khác nhau giữa các provider (<c>"IsDeleted" = false</c> Postgres, <c>[IsDeleted] = 0</c> SQL Server,
/// <c>"IsDeleted" = 0</c> SQLite) nên Configuration chỉ đánh dấu, <c>AppDbContext</c> điền SQL đúng provider lúc dựng model.
/// </summary>
/// <example>
/// <code>
/// builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();
/// </code>
/// </example>
public static class SoftDeleteIndexExtensions
{
    /// <summary>Dấu hiệu tạm trong filter của index, được AppDbContext thay bằng SQL theo provider.</summary>
    public const string FilterPlaceholder = "{{NotDeleted}}";

    public static IndexBuilder<T> WhereNotDeleted<T>(this IndexBuilder<T> builder)
        where T : ISoftDelete => builder.HasFilter(FilterPlaceholder);
}
