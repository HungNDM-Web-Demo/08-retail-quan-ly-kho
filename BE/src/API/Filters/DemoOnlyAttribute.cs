namespace API.Filters;

/// <summary>
/// Đánh dấu controller chỉ có khi <c>DEMO_MODE=true</c>. Khi tắt, controller bị gỡ khỏi ứng dụng (gọi vào nhận 404,
/// không hiện trong Swagger).
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class DemoOnlyAttribute : Attribute
{
}
