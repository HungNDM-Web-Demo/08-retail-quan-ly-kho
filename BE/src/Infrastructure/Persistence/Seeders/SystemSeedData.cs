using Domain.Entities.System.Roles;
using Domain.Entities.System.Users;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu nền sau khi ghép <c>system.json</c> (phần chung của _template) với <c>project.json</c> (phần riêng của dự án).
/// Quy tắc ghép (giống FE mock):
/// <list type="bullet">
/// <item><c>permissions</c>: thêm quyền nghiệp vụ; trùng <c>code</c> thì bản sau ghi đè nhóm, tên, thứ tự.</item>
/// <item><c>roles</c>: thêm vai trò riêng; trùng <c>code</c> thì ghi đè <c>name</c>/<c>description</c> đã khai báo,
/// không đổi <c>isSystem</c>, quyền khai báo thêm được cộng vào.</item>
/// <item><c>roleGrants</c>: cấp thêm quyền cho vai trò đã có. <c>"*"</c> là mọi quyền (sau khi ghép).</item>
/// <item><c>users</c>: thêm tài khoản demo; trùng <c>username</c> thì ghi đè các trường đã khai báo
/// (fullName, email, phone, description, roles, quickLogin, sortOrder), không tạo tài khoản mới;
/// <c>"enabled": false</c> bỏ hẳn tài khoản đó (dự án không dùng vai trò này).</item>
/// <item><c>settings</c>: trùng <c>key</c> thì ghi đè giá trị (và nhóm nếu khai báo); khóa mới thì thêm.</item>
/// <item><c>homeAfterLogin</c> chỉ FE dùng, BE bỏ qua.</item>
/// </list>
/// Dữ liệu sai (thiếu trường, quyền hoặc vai trò chưa khai báo) thì báo lỗi ngay khi khởi động.
/// </summary>
public sealed class SystemSeedData
{
    public const string SystemFileName = "system.json";
    public const string ProjectFileName = "project.json";
    public const string AllPermissions = "*";

    private static readonly Lazy<SystemSeedData> EmbeddedData = new(LoadEmbedded);

    private SystemSeedData(
        IReadOnlyList<PermissionSeed> permissions,
        IReadOnlyList<RoleSeed> roles,
        IReadOnlyList<UserSeed> users,
        IReadOnlyList<SettingSeed> settings)
    {
        Permissions = permissions;
        Roles = roles;
        Users = users;
        Settings = settings;
    }

    public IReadOnlyList<PermissionSeed> Permissions { get; }
    public IReadOnlyList<RoleSeed> Roles { get; }
    public IReadOnlyList<UserSeed> Users { get; }
    public IReadOnlyList<SettingSeed> Settings { get; }

    /// <summary>Dữ liệu ghép từ file nhúng trong assembly, nạp một lần.</summary>
    public static SystemSeedData Embedded => EmbeddedData.Value;

    /// <summary>Tài khoản hiện ở nút "Đăng nhập nhanh", theo thứ tự hiển thị.</summary>
    public IEnumerable<UserSeed> QuickLoginUsers =>
        Users.Where(u => u.QuickLogin).OrderBy(u => u.SortOrder).ThenBy(u => u.Username, StringComparer.Ordinal);

    internal static SystemSeedData Merge(SeedFile system, SeedFile? project)
    {
        project ??= new SeedFile();

        var permissions = MergePermissions(system, project);
        var roles = MergeRoles(system, project, permissions);
        var users = MergeUsers(system, project, roles);
        var settings = MergeSettings(system, project);
        return new SystemSeedData(permissions, roles, users, settings);
    }

    private static SystemSeedData LoadEmbedded() =>
        Merge(SeedJson.Read<SeedFile>(SystemFileName), SeedJson.ReadOptional<SeedFile>(ProjectFileName));

    private static List<PermissionSeed> MergePermissions(SeedFile system, SeedFile project)
    {
        var result = new List<PermissionSeed>();
        var indexByCode = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var item in (system.Permissions ?? []).Concat(project.Permissions ?? []))
        {
            var code = NormalizePermission(Required(item.Code, "permissions[].code"));
            var seed = new PermissionSeed(
                code,
                Required(item.GroupName, $"groupName của quyền {code}").Trim(),
                Required(item.Name, $"name của quyền {code}").Trim(),
                item.SortOrder);

            if (indexByCode.TryGetValue(code, out var index))
            {
                result[index] = seed;
            }
            else
            {
                indexByCode[code] = result.Count;
                result.Add(seed);
            }
        }

        if (result.Count == 0)
            throw Invalid("không có quyền nào trong permissions.");

        return result;
    }

    private static List<RoleSeed> MergeRoles(SeedFile system, SeedFile project, List<PermissionSeed> permissions)
    {
        var drafts = new List<RoleDraft>();
        var byCode = new Dictionary<string, RoleDraft>(StringComparer.Ordinal);

        foreach (var item in (system.Roles ?? []).Concat(project.Roles ?? []))
        {
            var code = Role.NormalizeCode(Required(item.Code, "roles[].code"));
            if (byCode.TryGetValue(code, out var existing))
            {
                existing.Name = item.Name?.Trim() ?? existing.Name;
                existing.Description = item.Description ?? existing.Description;
                existing.Permissions.AddRange(item.Permissions ?? []);
                continue;
            }

            var draft = new RoleDraft
            {
                Code = code,
                Name = Required(item.Name, $"name của vai trò {code}").Trim(),
                Description = item.Description,
                IsSystem = item.IsSystem ?? false,
                Permissions = item.Permissions?.ToList() ?? []
            };
            drafts.Add(draft);
            byCode[code] = draft;
        }

        var grants = (system.RoleGrants ?? new Dictionary<string, List<string>>())
            .Concat(project.RoleGrants ?? new Dictionary<string, List<string>>());
        foreach (var (roleCode, codes) in grants)
        {
            if (!byCode.TryGetValue(Role.NormalizeCode(roleCode), out var draft))
                throw Invalid($"roleGrants cấp quyền cho vai trò '{roleCode}' chưa khai báo trong roles.");
            draft.Permissions.AddRange(codes ?? []);
        }

        var order = permissions.Select((p, i) => (p.Code, i)).ToDictionary(x => x.Code, x => x.i, StringComparer.Ordinal);
        return drafts.Select(draft =>
        {
            var codes = new HashSet<string>(StringComparer.Ordinal);
            foreach (var raw in draft.Permissions)
            {
                var value = raw?.Trim() ?? string.Empty;
                if (value == AllPermissions)
                {
                    codes.UnionWith(order.Keys);
                    continue;
                }

                var code = NormalizePermission(value);
                if (!order.ContainsKey(code))
                    throw Invalid($"vai trò {draft.Code} dùng quyền '{value}' chưa khai báo trong permissions.");
                codes.Add(code);
            }

            return new RoleSeed(
                draft.Code,
                draft.Name,
                string.IsNullOrWhiteSpace(draft.Description) ? null : draft.Description.Trim(),
                draft.IsSystem,
                codes.OrderBy(c => order[c]).ToList());
        }).ToList();
    }

    private static List<UserSeed> MergeUsers(SeedFile system, SeedFile project, List<RoleSeed> roles)
    {
        var roleCodes = roles.Select(r => r.Code).ToHashSet(StringComparer.Ordinal);
        var drafts = new List<UserDraft>();
        var byUsername = new Dictionary<string, UserDraft>(StringComparer.Ordinal);

        foreach (var item in (system.Users ?? []).Concat(project.Users ?? []))
        {
            var username = User.NormalizeUsername(Required(item.Username, "users[].username"));
            if (item.Enabled == false)
            {
                // Dự án không dùng tài khoản này của nền: bỏ khỏi seed (SystemSeeder xóa nếu DB đã có)
                if (byUsername.Remove(username, out var disabled))
                    drafts.Remove(disabled);
                continue;
            }

            if (byUsername.TryGetValue(username, out var existing))
            {
                existing.FullName = item.FullName?.Trim() ?? existing.FullName;
                existing.Email = item.Email ?? existing.Email;
                existing.Phone = item.Phone ?? existing.Phone;
                existing.Description = item.Description ?? existing.Description;
                existing.Roles = item.Roles is null ? existing.Roles : NormalizeRoles(item.Roles);
                existing.QuickLogin = item.QuickLogin ?? existing.QuickLogin;
                existing.SortOrder = item.SortOrder ?? existing.SortOrder;
                continue;
            }

            var draft = new UserDraft
            {
                Username = username,
                FullName = Required(item.FullName, $"fullName của tài khoản {username}").Trim(),
                Email = item.Email,
                Phone = item.Phone,
                Roles = NormalizeRoles(item.Roles ?? []),
                IsDemoAccount = item.IsDemoAccount ?? true,
                QuickLogin = item.QuickLogin ?? false,
                SortOrder = item.SortOrder ?? (drafts.Count == 0 ? 1 : drafts.Max(d => d.SortOrder) + 1),
                Description = item.Description ?? string.Empty
            };
            drafts.Add(draft);
            byUsername[username] = draft;
        }

        foreach (var draft in drafts)
        {
            if (draft.Roles.Count == 0)
                throw Invalid($"tài khoản {draft.Username} chưa có vai trò.");

            var unknown = draft.Roles.FirstOrDefault(r => !roleCodes.Contains(r));
            if (unknown is not null)
                throw Invalid($"tài khoản {draft.Username} dùng vai trò '{unknown}' chưa khai báo trong roles.");
        }

        return drafts
            .Select(d => new UserSeed(
                d.Username, d.FullName, d.Email, d.Phone, d.Roles, d.IsDemoAccount, d.QuickLogin, d.SortOrder, d.Description))
            .ToList();
    }

    private static List<SettingSeed> MergeSettings(SeedFile system, SeedFile project)
    {
        var result = new List<SettingSeed>();
        var indexByKey = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in (system.Settings ?? []).Concat(project.Settings ?? []))
        {
            var key = Required(item.Key, "settings[].key").Trim();
            if (indexByKey.TryGetValue(key, out var index))
            {
                var existing = result[index];
                result[index] = existing with
                {
                    Value = item.Value ?? existing.Value,
                    GroupName = item.GroupName?.Trim() ?? existing.GroupName
                };
                continue;
            }

            indexByKey[key] = result.Count;
            result.Add(new SettingSeed(
                key,
                item.Value ?? throw Invalid($"thiếu value của cài đặt {key}."),
                Required(item.GroupName, $"groupName của cài đặt {key}").Trim()));
        }

        return result;
    }

    private static List<string> NormalizeRoles(IEnumerable<string> roles) =>
        roles.Where(r => !string.IsNullOrWhiteSpace(r)).Select(Role.NormalizeCode).Distinct(StringComparer.Ordinal).ToList();

    private static string NormalizePermission(string code) => code.Trim().ToLowerInvariant();

    private static string Required(string? value, string field) =>
        string.IsNullOrWhiteSpace(value) ? throw Invalid($"thiếu {field}.") : value;

    private static InvalidOperationException Invalid(string message) =>
        new($"Dữ liệu seed không hợp lệ (FE/src/mock/seed/system.json, project.json): {message}");

    private sealed class RoleDraft
    {
        public required string Code { get; init; }
        public required string Name { get; set; }
        public string? Description { get; set; }
        public bool IsSystem { get; init; }
        public List<string> Permissions { get; init; } = [];
    }

    private sealed class UserDraft
    {
        public required string Username { get; init; }
        public required string FullName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public List<string> Roles { get; set; } = [];
        public bool IsDemoAccount { get; init; }
        public bool QuickLogin { get; set; }
        public int SortOrder { get; set; }
        public string Description { get; set; } = string.Empty;
    }
}
