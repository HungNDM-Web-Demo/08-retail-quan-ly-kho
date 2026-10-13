namespace Application.DTOs.Roles;

/// <summary>Một quyền trong nhóm.</summary>
public sealed record PermissionItem
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
}
