using System.Text.RegularExpressions;
using Domain.Enums.Inventory;

namespace Domain.Entities.Inventory;

/// <summary>
/// Công thức thuần của 07 §3 (BE và FE mock cùng kết quả). Mọi số tiền là số nguyên đồng; phép chia làm tròn tới 1 ₫,
/// từ 0,5 làm tròn lên, viết bằng số nguyên: <c>round(a ÷ b) = floor((2a + b) ÷ (2b))</c>.
/// </summary>
public static partial class StockMath
{
    /// <summary>round(a ÷ b) với a ≥ 0, b &gt; 0 (§3.2).</summary>
    public static decimal RoundDiv(decimal a, decimal b)
    {
        if (b <= 0)
            throw new ArgumentOutOfRangeException(nameof(b));
        var numerator = (long)(2 * a + b);
        var denominator = (long)(2 * b);
        return numerator / denominator;
    }

    /// <summary>BR-01: số lượng quy đổi về đơn vị cơ bản.</summary>
    public static int ToBase(int quantity, int factor) => checked(quantity * factor);

    /// <summary>
    /// BR-08 (§3.2): phân bổ chi phí mua hàng theo thành tiền, dòng cuối nhận phần còn lại;
    /// tổng thành tiền 0 thì theo số lượng quy đổi.
    /// </summary>
    public static decimal[] AllocateFreight(IReadOnlyList<decimal> amounts, IReadOnlyList<int> baseQuantities, decimal freight)
    {
        var result = new decimal[amounts.Count];
        if (freight <= 0 || amounts.Count == 0)
            return result;

        var weights = amounts.Sum() == 0 ? baseQuantities.Select(q => (decimal)q).ToList() : amounts.ToList();
        var total = weights.Sum();
        if (total <= 0)
        {
            result[^1] = freight;
            return result;
        }

        decimal used = 0;
        for (var i = 0; i < weights.Count; i++)
        {
            if (i == weights.Count - 1)
            {
                result[i] = freight - used;
                break;
            }

            result[i] = RoundDiv(freight * weights[i], total);
            used += result[i];
        }

        return result;
    }

    /// <summary>Đơn giá nhập kho hiển thị: round(value ÷ quantity).</summary>
    public static decimal LandedUnitPrice(decimal value, int quantity) => quantity > 0 ? RoundDiv(value, quantity) : 0;

    /// <summary>BR-09 (§3.3): giá vốn mới sau khi nhập <paramref name="q"/> đơn vị trị giá <paramref name="v"/>.</summary>
    public static decimal AvgCostAfterIn(int onHand, decimal stockValue, int q, decimal v) =>
        RoundDiv(stockValue + v, onHand + q);

    /// <summary>BR-10 (§3.4): giá trị xuất; xuất hết thì lấy đúng giá trị còn lại.</summary>
    public static decimal OutValue(int onHand, decimal stockValue, decimal avgCost, int q) =>
        q == onHand ? stockValue : q * avgCost;

    /// <summary>BR-17 (§3.7): độ lớn giá trị điều chỉnh kiểm kê; thiếu về 0 thì bằng giá trị tồn còn lại.</summary>
    public static decimal AdjustValue(int onHand, decimal stockValue, int difference, decimal bookCost) =>
        difference >= 0 ? difference * bookCost
        : onHand + difference == 0 ? stockValue
        : -difference * bookCost;

    /// <summary>BR-18 (§3.9).</summary>
    public static StockStatus Status(int onHand, int available, int? minQty, int? maxQty) =>
        onHand == 0 ? StockStatus.HetHang
        : minQty is { } min && available <= min ? StockStatus.DuoiToiThieu
        : maxQty is { } max && onHand > max ? StockStatus.VuotToiDa
        : StockStatus.BinhThuong;

    /// <summary>Cảnh báo chỉ lấy dòng có ngưỡng tương ứng (§3.9, quyết định 27).</summary>
    public static bool IsAlert(StockStatus status, int? minQty, int? maxQty) => status switch
    {
        StockStatus.HetHang => minQty is not null || maxQty is not null,
        StockStatus.DuoiToiThieu => minQty is not null,
        StockStatus.VuotToiDa => maxQty is not null,
        _ => false
    };

    /// <summary>BR-19 (§3.9): đề xuất nhập theo bội số đơn vị lớn nhất; không có tồn tối đa thì null.</summary>
    public static int? SuggestQuantity(int? maxQty, int available, int largestFactor)
    {
        if (maxQty is not { } max)
            return null;
        var factor = Math.Max(1, largestFactor);
        var raw = max - available;
        var suggested = (int)Math.Floor(raw / (double)factor) * factor;
        return suggested <= 0 ? factor : suggested;
    }

    /// <summary>Chênh lệch kiểm kê (BR-16, §3.7).</summary>
    public static Variance VarianceOf(int bookQuantity, int counted, decimal bookCost, decimal currentStockValue)
    {
        var difference = counted - bookQuantity;
        var value = counted == 0 && bookQuantity > 0 ? -currentStockValue : difference * bookCost;
        decimal? percent = bookQuantity > 0
            ? Math.Round(Math.Abs(difference) * 100m / bookQuantity, 1, MidpointRounding.AwayFromZero)
            : null;
        var required = Math.Abs(value) >= InventoryRules.VarianceValueThreshold
            || (bookQuantity > 0 && Math.Abs((long)difference) * 100 >= (long)InventoryRules.VariancePercentThreshold * bookQuantity)
            || (bookQuantity == 0 && counted > 0);
        return new Variance(difference, value, percent, required);
    }

    /// <summary>|chênh| ÷ sổ sách × 100, 1 chữ số; sổ sách 0 thì null.</summary>
    public static decimal? DifferencePercent(int bookQuantity, int? difference) =>
        bookQuantity > 0 && difference is { } d
            ? Math.Round(Math.Abs(d) * 100m / bookQuantity, 1, MidpointRounding.AwayFromZero)
            : null;

    /// <summary>BR-22 (§3.11): nhóm chậm luân chuyển; dưới 30 ngày thì null.</summary>
    public static SlowMovingBucket? SlowBucket(int days) =>
        days >= 90 ? SlowMovingBucket.Tu90
        : days >= 60 ? SlowMovingBucket.Tu60
        : days >= 30 ? SlowMovingBucket.Tu30
        : null;

    /// <summary>BR-13: đang chuyển quá 3 ngày.</summary>
    public static bool IsLate(DateTime approvedAtUtc, DateTime nowUtc) =>
        nowUtc - approvedAtUtc > TimeSpan.FromDays(InventoryRules.LateDays);

    /// <summary>Tên ngắn: bỏ phần số cuối, viết thường ("Thùng 24" → "thùng").</summary>
    public static string UnitShortName(string name) => TrailingNumber().Replace(name.Trim(), string.Empty).Trim().ToLowerInvariant();

    /// <summary>BR-01 (§3.1): "23 thùng 16 chai".</summary>
    public static string ReadQuantity(int quantity, string baseUnit, IEnumerable<(string Name, int Factor)> units)
    {
        var baseName = baseUnit.Trim().ToLowerInvariant();
        if (quantity == 0)
            return $"0 {baseName}";

        var sign = quantity < 0 ? "-" : string.Empty;
        var rest = Math.Abs(quantity);
        var parts = new List<string>();
        foreach (var unit in units.Where(u => u.Factor > 1).OrderByDescending(u => u.Factor))
        {
            var n = rest / unit.Factor;
            if (n <= 0)
                continue;
            parts.Add($"{InventoryRules.Number(n)} {UnitShortName(unit.Name)}");
            rest -= n * unit.Factor;
        }

        if (rest > 0)
            parts.Add($"{InventoryRules.Number(rest)} {baseName}");
        return sign + string.Join(' ', parts);
    }

    [GeneratedRegex(@"\s*\d+$")]
    private static partial Regex TrailingNumber();
}

/// <summary>Kết quả chênh lệch một dòng kiểm kê.</summary>
public readonly record struct Variance(int Difference, decimal Value, decimal? Percent, bool ReasonRequired);
