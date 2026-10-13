namespace Application.Common.Models;

/// <summary>
/// Query chung cho mọi API danh sách (QUY-UOC-API §1.2). Bộ lọc riêng thì kế thừa lớp này.
/// </summary>
public class PaginationQuery
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 100;
    public const string DefaultSortBy = "createdAt";

    /// <summary>Trang cần lấy, bắt đầu từ 1.</summary>
    public int Page { get; set; } = DefaultPage;

    /// <summary>Số dòng mỗi trang, mặc định 10, tối đa 100.</summary>
    public int PageSize { get; set; } = DefaultPageSize;

    /// <summary>Từ khóa tìm theo các cột chữ chính (mã, tên, số điện thoại…).</summary>
    public string? Search { get; set; }

    /// <summary>Tên trường camelCase để sắp xếp, mặc định <c>createdAt</c>.</summary>
    public string? SortBy { get; set; }

    /// <summary><c>asc</c> hoặc <c>desc</c>, mặc định <c>desc</c>.</summary>
    public string? SortDir { get; set; }

    public int GetPage() => Page < 1 ? DefaultPage : Page;

    public int GetPageSize() => PageSize < 1 ? DefaultPageSize : Math.Min(PageSize, MaxPageSize);

    /// <summary>Từ khóa đã bỏ khoảng trắng hai đầu; null khi không tìm.</summary>
    public string? GetSearchTerm() => string.IsNullOrWhiteSpace(Search) ? null : Search.Trim();

    public string GetSortBy() => string.IsNullOrWhiteSpace(SortBy) ? DefaultSortBy : SortBy.Trim();

    public bool IsDescending() => !string.Equals(SortDir?.Trim(), "asc", StringComparison.OrdinalIgnoreCase);
}
