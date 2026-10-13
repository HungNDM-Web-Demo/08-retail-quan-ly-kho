using System.Text.Json.Serialization;

namespace Application.DTOs.Users;

/// <summary>Khóa (<c>false</c>) hoặc mở khóa (<c>true</c>) tài khoản.</summary>
public sealed record LockUserRequest
{
    /// <summary>Bắt buộc gửi lên, tránh vô tình khóa tài khoản khi thiếu trường.</summary>
    [JsonRequired]
    public bool IsActive { get; init; }
}
