namespace Application.DTOs.Users;

/// <summary>Vai trò rút gọn gắn với tài khoản.</summary>
public sealed record RoleSummaryDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}
