namespace Infrastructure.Security;

/// <summary>Tên claim trong JWT (KIEN-TRUC-HE-THONG §7.1). Giữ nguyên tên gốc, không ánh xạ sang ClaimTypes của .NET.</summary>
public static class AppClaimTypes
{
    /// <summary>Id tài khoản.</summary>
    public const string Subject = "sub";

    /// <summary>Tên đăng nhập.</summary>
    public const string Name = "name";

    public const string FullName = "fullname";

    /// <summary>Mảng mã vai trò.</summary>
    public const string Roles = "roles";

    /// <summary>Mảng mã quyền tại thời điểm cấp token.</summary>
    public const string Permissions = "permissions";

    /// <summary>"true" khi có vai trò ADMIN.</summary>
    public const string IsSuperAdmin = "is_super_admin";

    /// <summary>Mã phiên đăng nhập, trùng Id refresh token của phiên.</summary>
    public const string SessionId = "sid";

    public const string TokenId = "jti";
}
