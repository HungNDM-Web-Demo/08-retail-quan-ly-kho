using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Domain.Enums.Inventory;

namespace Infrastructure.Persistence.Seeders;

// Hình dạng của FE/src/mock/seed/demo-data.json (06 §5.2, §5.4; FE src/types/inventory-seed.ts).
// Mốc thời gian, dòng phiếu là mảng gọn nên đọc bằng JsonElement rồi suy ra trong DemoDataSeeder.

internal sealed class InventorySeedFile
{
    public List<SeedGroup> ProductGroups { get; init; } = [];
    public List<SeedWarehouse> Warehouses { get; init; } = [];
    public List<SeedSupplier> Suppliers { get; init; } = [];
    public List<SeedProduct> Products { get; init; } = [];
    public List<SeedReceipt> Receipts { get; init; } = [];
    public List<SeedIssue> Issues { get; init; } = [];
    public List<SeedTransfer> Transfers { get; init; } = [];
    public List<SeedStocktake> Stocktakes { get; init; } = [];
}

internal sealed record SeedGroup(string Code, string Name, string Color);

internal sealed record SeedWarehouse(string Code, string Name, string? Address, string? Phone, List<string>? Keepers, bool? Active);

internal sealed record SeedSupplier(
    string Code, string Name, string? TaxCode, string? Phone, string? Address, string? ContactName, bool? Active);

internal sealed class SeedProduct
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Group { get; init; } = string.Empty;
    public string Unit { get; init; } = string.Empty;
    public string? Barcode { get; init; }
    public string? Spec { get; init; }
    public string? Image { get; init; }

    /// <summary><c>[[tên, hệ số, mã vạch]]</c>.</summary>
    public List<List<JsonElement>> Units { get; init; } = [];

    /// <summary><c>{ mã kho: [min, max] }</c>, null = không đặt.</summary>
    public Dictionary<string, List<int?>> Stock { get; init; } = [];
}

/// <summary>Khóa chung của phiếu nhập, xuất, chuyển (06 §5.4).</summary>
internal abstract class SeedDocument
{
    public string Id { get; init; } = string.Empty;
    public string By { get; init; } = string.Empty;
    public JsonElement Cr { get; init; }
    public JsonElement? Sb { get; init; }
    public List<JsonElement>? Rj { get; init; }
    public JsonElement? Sb2 { get; init; }
    public List<JsonElement>? Ap { get; init; }
    public List<JsonElement>? Cx { get; init; }
}

internal sealed class SeedReceipt : SeedDocument
{
    public string W { get; init; } = string.Empty;
    public ReceiptType T { get; init; }
    public string? S { get; init; }
    public List<JsonElement>? Inv { get; init; }
    public string? Dl { get; init; }
    public decimal? F { get; init; }
    public string? Nt { get; init; }
    public string? Rv { get; init; }

    /// <summary><c>[mã hàng, chỉ số đơn vị, số lượng, đơn giá]</c>.</summary>
    public List<List<JsonElement>> Ln { get; init; } = [];
}

internal sealed class SeedIssue : SeedDocument
{
    public string W { get; init; } = string.Empty;
    public IssueType T { get; init; }
    public string? Rc { get; init; }
    public string? S { get; init; }

    [JsonPropertyName("or")]
    public string? OrderRef { get; init; }

    public string? Why { get; init; }
    public string? Rv { get; init; }

    /// <summary><c>[mã hàng, chỉ số đơn vị, số lượng]</c>.</summary>
    public List<List<JsonElement>> Ln { get; init; } = [];
}

internal sealed class SeedTransfer : SeedDocument
{
    public string Fw { get; init; } = string.Empty;
    public string Tw { get; init; } = string.Empty;
    public string? Nt { get; init; }
    public List<List<JsonElement>> Ln { get; init; } = [];

    /// <summary><c>[lúc, người nhận, [[chỉ số dòng, số thiếu]]?]</c>.</summary>
    public List<JsonElement>? Re { get; init; }
}

internal sealed class SeedStocktake
{
    public string Id { get; init; } = string.Empty;
    public string W { get; init; } = string.Empty;
    public JsonElement Sc { get; init; }
    public string By { get; init; } = string.Empty;
    public string Ct { get; init; } = string.Empty;
    public JsonElement Cr { get; init; }
    public JsonElement? Sb { get; init; }
    public List<JsonElement>? Ap { get; init; }
    public List<JsonElement>? Cx { get; init; }

    /// <summary><c>[mã hàng, chênh lệch, nguyên nhân?, ghi chú?]</c>.</summary>
    public List<List<JsonElement>> Df { get; init; } = [];
}

/// <summary>Mốc thời gian của seed (06 §5.3): <c>"{n}@HH:mm"</c> giờ Việt Nam, hoặc số phút âm tính từ lúc nạp.</summary>
internal sealed class SeedClock(TimeProvider timeProvider)
{
    private readonly DateTime _now = Floor(timeProvider.GetUtcNow().UtcDateTime);

    public DateTime Now => _now;

    public DateTime At(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number)
            return _now.AddMinutes(value.GetInt32());

        var text = value.GetString() ?? throw new FormatException("Mốc thời gian rỗng.");
        var parts = text.Split('@');
        var days = int.Parse(parts[0], CultureInfo.InvariantCulture);
        var time = TimeSpan.ParseExact(parts[1], @"hh\:mm", CultureInfo.InvariantCulture);
        return SeedDates.FromToday(timeProvider, -days, time);
    }

    public DateTime? At(JsonElement? value) => value is { } v ? At(v) : null;

    /// <summary>Hôm nay (giờ Việt Nam) lùi <paramref name="days"/> ngày.</summary>
    public DateOnly DaysAgo(int days) => DateOnly.FromDateTime(SeedDates.FromToday(timeProvider, -days, TimeSpan.FromHours(12)).AddHours(7));

    private static DateTime Floor(DateTime utc) =>
        new(utc.Ticks - (utc.Ticks % TimeSpan.TicksPerMinute), DateTimeKind.Utc);
}
