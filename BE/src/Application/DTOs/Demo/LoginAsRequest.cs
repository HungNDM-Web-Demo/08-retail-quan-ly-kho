namespace Application.DTOs.Demo;

/// <summary>Đăng nhập nhanh bằng mã vai trò.</summary>
public sealed record LoginAsRequest
{
    /// <summary>Mã vai trò, vd <c>ADMIN</c>, <c>MANAGER</c>, <c>STAFF</c>.</summary>
    public string RoleCode { get; init; } = string.Empty;
}
