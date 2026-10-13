namespace Application.DTOs.Roles;

/// <summary>Thay toàn bộ quyền của vai trò.</summary>
public sealed record UpdateRolePermissionsRequest
{
    /// <summary>Mã quyền sau khi cập nhật.</summary>
    public IReadOnlyList<string> Permissions { get; init; } = [];
}
