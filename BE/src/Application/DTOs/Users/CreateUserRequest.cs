namespace Application.DTOs.Users;

/// <summary>Tạo tài khoản và gán vai trò.</summary>
public sealed record CreateUserRequest
{
    /// <summary>3–50 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới (BR-SYS-01).</summary>
    public string Username { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }

    /// <summary>Tối thiểu 8 ký tự, có chữ và số (BR-SYS-02).</summary>
    public string Password { get; init; } = string.Empty;

    /// <summary>Id các vai trò, ít nhất một.</summary>
    public IReadOnlyList<Guid> RoleIds { get; init; } = [];
}
