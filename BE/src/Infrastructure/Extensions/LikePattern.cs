namespace Infrastructure.Extensions;

/// <summary>
/// Mẫu tìm kiếm cho <see cref="AppDbFunctions.Matches"/> (và <c>EF.Functions.Like</c> khi cần): thoát các ký tự đặc biệt
/// của LIKE bằng <see cref="EscapeCharacter"/> để chuỗi người dùng nhập được hiểu đúng nghĩa đen.
/// </summary>
/// <example>
/// <code>
/// var pattern = LikePattern.Contains(term);
/// query = query.Where(x => AppDbFunctions.Matches(x.Name, pattern));
/// </code>
/// </example>
public static class LikePattern
{
    public const string EscapeCharacter = "\\";

    /// <summary>Mẫu "chứa chuỗi", đã thoát các ký tự đặc biệt của LIKE.</summary>
    public static string Contains(string term) => $"%{Escape(term)}%";

    public static string Escape(string term) =>
        term.Replace(EscapeCharacter, EscapeCharacter + EscapeCharacter, StringComparison.Ordinal)
            .Replace("%", EscapeCharacter + "%", StringComparison.Ordinal)
            .Replace("_", EscapeCharacter + "_", StringComparison.Ordinal)
            .Replace("[", EscapeCharacter + "[", StringComparison.Ordinal);
}
