namespace Application.Constants;

/// <summary>
/// Mã quyền dạng <c>{resource}.{action}</c> (KIEN-TRUC-HE-THONG §7.3).
/// Mỗi mã ở đây phải có trong file seed FE/src/mock/seed (system.json cho quyền nền, project.json cho quyền nghiệp vụ)
/// và FE src/config/permissions.ts. Test <c>PermissionConstantsTests</c> kiểm tra việc này.
/// </summary>
public static class Permissions
{
    public static class Dashboard
    {
        public const string View = "dashboard.view";
    }

    public static class Users
    {
        public const string View = "users.view";
        public const string Create = "users.create";
        public const string Update = "users.update";
        public const string Delete = "users.delete";
    }

    public static class Roles
    {
        public const string View = "roles.view";
        public const string Create = "roles.create";
        public const string Update = "roles.update";
        public const string Delete = "roles.delete";
    }

    public static class Settings
    {
        public const string View = "settings.view";
        public const string Update = "settings.update";
    }

    public static class AuditLogs
    {
        public const string View = "audit-logs.view";
    }
}
