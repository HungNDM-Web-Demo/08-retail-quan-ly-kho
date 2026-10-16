using System.Globalization;
using System.Text;

namespace Domain.Entities.Inventory;

/// <summary>Chuẩn hóa chữ để tìm "gõ không dấu" trên mọi provider (FR-09): bỏ dấu, đ → d, chữ thường.</summary>
public static class TextSearch
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var decomposed = value.Trim().ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                builder.Append(c);
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
