using System.Linq.Expressions;
using System.Reflection;
using Application.Common.Models;
using Domain.Base;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Extensions;

/// <summary>Phân trang và sắp xếp thống nhất theo <see cref="PaginationQuery"/> (QUY-UOC-API §1.2).</summary>
public static class QueryablePaginationExtensions
{
    private static readonly MethodInfo OrderByMethod = GetQueryableMethod(nameof(Queryable.OrderBy));
    private static readonly MethodInfo OrderByDescendingMethod = GetQueryableMethod(nameof(Queryable.OrderByDescending));

    /// <summary>Đếm tổng, lấy đúng trang. Gọi sau khi đã lọc và sắp xếp.</summary>
    public static async Task<PaginatedResult<T>> ToPaginatedResultAsync<T>(
        this IQueryable<T> query,
        PaginationQuery pagination,
        CancellationToken ct = default)
    {
        var page = pagination.GetPage();
        var pageSize = pagination.GetPageSize();
        var totalCount = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new PaginatedResult<T>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    /// <summary>
    /// Sắp xếp theo <c>sortBy</c>/<c>sortDir</c>. <c>sortBy</c> là tên trường camelCase: tra trước trong
    /// <paramref name="customSorts"/> (trường tính toán như <c>userCount</c>), sau đó tới thuộc tính cùng tên của entity.
    /// Trường không hợp lệ thì dùng mặc định <c>createdAt desc</c>. Luôn thêm <c>Id</c> làm khóa phụ để phân trang ổn định.
    /// </summary>
    public static IQueryable<T> ApplySorting<T>(
        this IQueryable<T> query,
        PaginationQuery pagination,
        IReadOnlyDictionary<string, Expression<Func<T, object?>>>? customSorts = null)
        where T : BaseEntity
    {
        var keySelector = ResolveCustomSort(pagination.GetSortBy(), customSorts)
            ?? ResolvePropertySort<T>(pagination.GetSortBy())
            ?? (Expression<Func<T, DateTime>>)(e => e.CreatedAt);

        var method = (pagination.IsDescending() ? OrderByDescendingMethod : OrderByMethod)
            .MakeGenericMethod(typeof(T), keySelector.ReturnType);
        var ordered = (IOrderedQueryable<T>)method.Invoke(null, [query, keySelector])!;
        return ordered.ThenBy(e => e.Id);
    }

    private static LambdaExpression? ResolveCustomSort<T>(
        string sortBy,
        IReadOnlyDictionary<string, Expression<Func<T, object?>>>? customSorts)
    {
        if (customSorts is null)
            return null;

        var match = customSorts.FirstOrDefault(kv => string.Equals(kv.Key, sortBy, StringComparison.OrdinalIgnoreCase));
        if (match.Value is null)
            return null;

        // Bỏ phép ép kiểu sang object để EF dịch được ORDER BY với kiểu thật.
        var body = match.Value.Body is UnaryExpression { NodeType: ExpressionType.Convert or ExpressionType.ConvertChecked } convert
            ? convert.Operand
            : match.Value.Body;
        return Expression.Lambda(body, match.Value.Parameters);
    }

    private static LambdaExpression? ResolvePropertySort<T>(string sortBy)
    {
        var property = typeof(T).GetProperty(
            sortBy,
            BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
        if (property is null || !IsSortable(property.PropertyType))
            return null;

        var parameter = Expression.Parameter(typeof(T), "e");
        return Expression.Lambda(Expression.Property(parameter, property), parameter);
    }

    private static bool IsSortable(Type type)
    {
        var underlying = Nullable.GetUnderlyingType(type) ?? type;
        return underlying.IsPrimitive
            || underlying.IsEnum
            || underlying == typeof(string)
            || underlying == typeof(decimal)
            || underlying == typeof(DateTime)
            || underlying == typeof(DateTimeOffset)
            || underlying == typeof(DateOnly)
            || underlying == typeof(TimeOnly)
            || underlying == typeof(TimeSpan)
            || underlying == typeof(Guid);
    }

    private static MethodInfo GetQueryableMethod(string name) =>
        typeof(Queryable).GetMethods(BindingFlags.Public | BindingFlags.Static)
            .Single(m => m.Name == name && m.GetParameters().Length == 2);
}
