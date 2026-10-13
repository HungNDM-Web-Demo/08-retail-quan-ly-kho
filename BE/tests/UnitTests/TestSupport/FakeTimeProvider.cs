namespace UnitTests.TestSupport;

/// <summary>Đồng hồ giả: thời gian chỉ đổi khi gọi <see cref="Advance"/>.</summary>
public sealed class FakeTimeProvider(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan duration) => _now = _now.Add(duration);
}
