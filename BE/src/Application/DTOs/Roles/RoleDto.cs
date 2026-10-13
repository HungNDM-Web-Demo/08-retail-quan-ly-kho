using Application.Common.Models;

namespace Application.DTOs.Roles;

/// <summary>Vai trò kèm số tài khoản và danh sách mã quyền.</summary>
public sealed record RoleDto : IHasGuidId
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }

    /// <summary>Vai trò hệ thống không xóa được.</summary>
    public bool IsSystem { get; init; }

    /// <summary>Số tài khoản (chưa xóa) đang có vai trò này.</summary>
    public int UserCount { get; init; }

    /// <summary>Mã quyền của vai trò; ADMIN luôn có toàn bộ.</summary>
    public IReadOnlyList<string> Permissions { get; init; } = [];
}
