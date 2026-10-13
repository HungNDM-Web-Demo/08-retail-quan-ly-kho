namespace Application.Constants;

/// <summary>
/// Mã vai trò hệ thống (KIEN-TRUC-HE-THONG §7.4). Đặt tên <c>RoleCodes</c> để không trùng namespace <c>*.Roles</c>.
/// </summary>
public static class RoleCodes
{
    /// <summary>Quản trị viên, luôn có toàn bộ quyền (BR-SYS-06).</summary>
    public const string Admin = "ADMIN";

    public const string Manager = "MANAGER";

    public const string Staff = "STAFF";
}
