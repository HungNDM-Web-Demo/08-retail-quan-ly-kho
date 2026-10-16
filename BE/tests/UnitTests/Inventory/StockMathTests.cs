using Domain.Entities.Inventory;
using Domain.Enums.Inventory;

namespace UnitTests.Inventory;

/// <summary>Công thức 07 §3 theo bảng số tính sẵn §3.14.</summary>
public class StockMathTests
{
    [Theory]
    [InlineData(7443.75 * 4800, 4800, 7444)]
    [InlineData(10, 4, 3)]
    [InlineData(9, 4, 2)]
    [InlineData(0, 5, 0)]
    public void RoundDiv_HalfUp(double a, double b, int expected) =>
        Assert.Equal(expected, StockMath.RoundDiv((decimal)a, (decimal)b));

    [Fact]
    public void Tc08_FreightAllocation_LastLineTakesRemainder()
    {
        var allocated = StockMath.AllocateFreight([18_000_000m, 30_000_000m], [2400, 600], 1_200_000m);
        Assert.Equal([450_000m, 750_000m], allocated);
        Assert.Equal(7444m, StockMath.AvgCostAfterIn(2400, 17_280_000m, 2400, 18_450_000m));
        Assert.Equal(51_625m, StockMath.AvgCostAfterIn(600, 31_200_000m, 600, 30_750_000m));
    }

    [Fact]
    public void Freight_ZeroAmounts_AllocatesByQuantity()
    {
        var allocated = StockMath.AllocateFreight([0m, 0m], [1, 3], 100m);
        Assert.Equal([25m, 75m], allocated);
    }

    [Fact]
    public void Section314_Values()
    {
        Assert.Equal(7350m, StockMath.AvgCostAfterIn(2400, 17_280_000m, 2400, 18_000_000m)); // TC-13
        Assert.Equal(22_680_000m, StockMath.OutValue(200, 37_800_000m, 189_000m, 120)); // TC-14
        Assert.Equal(32_750m, StockMath.AvgCostAfterIn(120, 3_960_000m, 120, 3_900_000m)); // TC-16
        Assert.Equal(3_456_000m, StockMath.OutValue(2400, 17_280_000m, 7200m, 480)); // TC-18
        Assert.Equal(7216m, StockMath.AvgCostAfterIn(90, 657_000m, 478, 478 * 7200m)); // TC-18
        Assert.Equal(189_000m, StockMath.AvgCostAfterIn(80, 15_120_000m, 120, 22_680_000m)); // TC-20
        Assert.Equal(3_528_000m, StockMath.OutValue(4800, 35_280_000m, 7350m, 480)); // TC-23
        Assert.Equal(624, StockMath.SuggestQuantity(720, 90, 24)); // TC-25
        Assert.Equal(1_000_000m, StockMath.OutValue(5, 1_000_000m, 199_999m, 5)); // xuất hết lấy đúng giá trị còn lại
    }

    [Fact]
    public void Tc26_Tc30_Variance()
    {
        var dau = StockMath.VarianceOf(240, 237, 52_000m, 12_480_000m);
        Assert.Equal(-3, dau.Difference);
        Assert.Equal(-156_000m, dau.Value);
        Assert.Equal(1.3m, dau.Percent);
        Assert.False(dau.ReasonRequired);

        var nmam = StockMath.VarianceOf(120, 150, 33_000m, 3_960_000m);
        Assert.Equal(990_000m, nmam.Value);
        Assert.Equal(25.0m, nmam.Percent);
        Assert.True(nmam.ReasonRequired);

        var recount = StockMath.VarianceOf(120, 125, 33_000m, 3_960_000m);
        Assert.Equal(165_000m, recount.Value);
        Assert.Equal(4.2m, recount.Percent);
        Assert.False(recount.ReasonRequired);

        var toZero = StockMath.VarianceOf(10, 0, 100m, 1_234m);
        Assert.Equal(-1_234m, toZero.Value);
        Assert.True(StockMath.VarianceOf(0, 3, 0m, 0m).ReasonRequired);
        Assert.True(StockMath.VarianceOf(100, 105, 1m, 100m).ReasonRequired);
        Assert.True(StockMath.VarianceOf(10, 5, 300_000m, 3_000_000m).ReasonRequired);
    }

    [Fact]
    public void Br01_ReadQuantity()
    {
        (string, int)[] thung24 = [("Thùng 24", 24)];
        Assert.Equal("23 thùng 16 chai", StockMath.ReadQuantity(568, "Chai", thung24));
        Assert.Equal("200 thùng", StockMath.ReadQuantity(4800, "Chai", thung24));
        Assert.Equal("3 thùng 18 chai", StockMath.ReadQuantity(90, "Chai", thung24));
        Assert.Equal("20 thùng", StockMath.ReadQuantity(80, "Túi", [("Thùng 4", 4)]));
        Assert.Equal("1 thùng 1 lốc", StockMath.ReadQuantity(30, "Lon", [("Lốc 6", 6), ("Thùng 24", 24)]));
        Assert.Equal("1 lốc 1 lon", StockMath.ReadQuantity(7, "Lon", [("Lốc 6", 6), ("Thùng 24", 24)]));
        Assert.Equal("0 chai", StockMath.ReadQuantity(0, "Chai", thung24));
    }

    [Fact]
    public void Br18_StatusAndAlerts()
    {
        Assert.Equal(StockStatus.HetHang, StockMath.Status(0, 0, null, null));
        Assert.False(StockMath.IsAlert(StockStatus.HetHang, null, null));
        Assert.Equal(StockStatus.DuoiToiThieu, StockMath.Status(200, 80, 80, 400));
        Assert.Equal(StockStatus.VuotToiDa, StockMath.Status(500, 500, 80, 400));
        Assert.Equal(StockStatus.BinhThuong, StockMath.Status(200, 200, 80, 400));
        Assert.Null(StockMath.SuggestQuantity(null, 10, 24));
        Assert.Equal(24, StockMath.SuggestQuantity(100, 90, 24));
    }

    [Fact]
    public void Br22_Br13_Buckets()
    {
        Assert.Null(StockMath.SlowBucket(29));
        Assert.Equal(SlowMovingBucket.Tu30, StockMath.SlowBucket(30));
        Assert.Equal(SlowMovingBucket.Tu60, StockMath.SlowBucket(75));
        Assert.Equal(SlowMovingBucket.Tu90, StockMath.SlowBucket(90));
        var now = new DateTime(2026, 10, 15, 5, 0, 0, DateTimeKind.Utc);
        Assert.True(StockMath.IsLate(now.AddDays(-4), now));
        Assert.False(StockMath.IsLate(now.AddDays(-1), now));
    }
}
