using Application.Common.Models;

namespace Application.DTOs.Users;

/// <summary>Tài khoản trong danh sách và chi tiết.</summary>
public sealed record UserDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Username { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? AvatarUrl { get; init; }
    public bool IsActive { get; init; }
    public bool IsDemoAccount { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public IReadOnlyList<RoleSummaryDto> Roles { get; init; } = [];
}
