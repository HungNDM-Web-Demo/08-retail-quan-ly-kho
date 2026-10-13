namespace Application.DTOs.Roles;

/// <summary>Sửa tên, mô tả vai trò.</summary>
public sealed record UpdateRoleRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
}
