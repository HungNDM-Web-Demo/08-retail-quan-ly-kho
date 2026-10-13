namespace Application.Common.Models;

/// <summary>Kết quả phân trang trả về cho mọi API danh sách (QUY-UOC-API §1.2).</summary>
public sealed class PaginatedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;

    /// <summary>Đổi kiểu phần tử (vd entity sang DTO), giữ nguyên thông tin phân trang.</summary>
    public PaginatedResult<TResult> Map<TResult>(Func<IReadOnlyList<T>, IReadOnlyList<TResult>> mapItems) =>
        new()
        {
            Items = mapItems(Items),
            Page = Page,
            PageSize = PageSize,
            TotalCount = TotalCount
        };
}
