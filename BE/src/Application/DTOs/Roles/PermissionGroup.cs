namespace Application.DTOs.Roles;

/// <summary>Nhóm quyền cho ma trận phân quyền.</summary>
public sealed record PermissionGroup
{
    public string GroupName { get; init; } = string.Empty;
    public IReadOnlyList<PermissionItem> Items { get; init; } = [];
}
