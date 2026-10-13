using System.Xml;

namespace Infrastructure.Implementations.Services.Uploads;

/// <summary>Thiết lập đọc SVG an toàn: cấm DTD (chặn XXE, bom thực thể), không tải tài nguyên ngoài.</summary>
internal static class SvgReaderSettings
{
    private const long MaxCharacters = 4 * 1024 * 1024;

    public static XmlReaderSettings Create() => new()
    {
        DtdProcessing = DtdProcessing.Prohibit,
        XmlResolver = null,
        IgnoreComments = true,
        IgnoreProcessingInstructions = true,
        IgnoreWhitespace = true,
        MaxCharactersInDocument = MaxCharacters
    };
}
