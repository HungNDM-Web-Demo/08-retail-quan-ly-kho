namespace Application.DTOs.Roles;

/// <summary>Tạo vai trò mới kèm quyền.</summary>
public sealed record CreateRoleRequest
{
    /// <summary>Mã viết hoa không dấu, số, gạch dưới, vd <c>CASHIER</c>.</summary>
    public string Code { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }

    /// <summary>Mã quyền, vd <c>["dashboard.view"]</c>.</summary>
    public IReadOnlyList<string> Permissions { get; init; } = [];
}
