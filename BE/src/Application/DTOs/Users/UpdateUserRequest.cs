namespace Application.DTOs.Users;

/// <summary>Sửa thông tin và vai trò của tài khoản.</summary>
public sealed record UpdateUserRequest
{
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }

    /// <summary>Id các vai trò, ít nhất một.</summary>
    public IReadOnlyList<Guid> RoleIds { get; init; } = [];
}
