namespace API.Controllers.Health;

/// <summary>Kết quả kiểm tra sức khỏe hệ thống.</summary>
/// <param name="Status"><c>Healthy</c>, <c>Degraded</c> hoặc <c>Unhealthy</c>.</param>
/// <param name="Checks">Trạng thái từng thành phần, vd <c>database</c>.</param>
/// <param name="Time">Giờ máy chủ (UTC).</param>
public sealed record HealthResponse(string Status, IReadOnlyDictionary<string, string> Checks, DateTime Time);
