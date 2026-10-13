using Application.Constants;
using Application.Interfaces.Services.Auth;
using Domain.Entities.System.Permissions;
using Domain.Entities.System.Roles;
using Domain.Entities.System.Settings;
using Domain.Entities.System.Users;
using Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Đồng bộ dữ liệu nền (quyền, vai trò, tài khoản demo, cài đặt) theo <see cref="SystemSeedData"/>. Chạy lặp lại an toàn:
/// <list type="bullet">
/// <item>Quyền: thêm quyền mới, cập nhật nhóm/tên/thứ tự, xóa quyền không còn trong file.</item>
/// <item>Vai trò: tạo vai trò còn thiếu; vai trò hệ thống (isSystem) được đặt lại quyền đúng như file; ADMIN luôn đủ mọi quyền.</item>
/// <item>Tài khoản: tạo tài khoản còn thiếu với mật khẩu <c>DEMO_PASSWORD</c>, gán thêm vai trò khai báo trong file;
/// tài khoản demo có mật khẩu khác <c>DEMO_PASSWORD</c> thì đặt lại.</item>
/// <item>Cài đặt: tạo khóa còn thiếu; không ghi đè giá trị người dùng đã sửa.</item>
/// </list>
/// </summary>
public sealed class SystemSeeder(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    IOptions<DemoOptions> demoOptions,
    ILogger<SystemSeeder> logger)
{
    public Task SeedAsync(CancellationToken ct = default) => SeedAsync(SystemSeedData.Embedded, ct);

    internal async Task SeedAsync(SystemSeedData seed, CancellationToken ct)
    {
        var previous = db.SuppressAuditLog;
        db.SuppressAuditLog = true;
        try
        {
            var permissions = await SyncPermissionsAsync(seed, ct);
            await db.SaveChangesAsync(ct);

            var roles = await SyncRolesAsync(seed, permissions, ct);
            await db.SaveChangesAsync(ct);

            await SyncUsersAsync(seed, roles, ct);
            await SyncSettingsAsync(seed, ct);
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            db.SuppressAuditLog = previous;
        }
    }

    private async Task<Dictionary<string, Permission>> SyncPermissionsAsync(SystemSeedData seed, CancellationToken ct)
    {
        var existing = await db.Permissions.ToListAsync(ct);
        var byCode = existing.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);
        var added = 0;

        foreach (var item in seed.Permissions)
        {
            if (byCode.TryGetValue(item.Code, out var permission))
            {
                permission.UpdateMetadata(item.GroupName, item.Name, item.SortOrder);
            }
            else
            {
                permission = Permission.Create(item.Code, item.GroupName, item.Name, item.SortOrder);
                db.Permissions.Add(permission);
                byCode[item.Code] = permission;
                added++;
            }
        }

        var seedCodes = seed.Permissions.Select(p => p.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var stale = existing.Where(p => !seedCodes.Contains(p.Code)).ToList();
        foreach (var permission in stale)
        {
            db.Permissions.Remove(permission);
            byCode.Remove(permission.Code);
        }

        if (added > 0 || stale.Count > 0)
            logger.LogInformation("Seed quyền: thêm {Added}, xóa {Removed}.", added, stale.Count);

        return byCode;
    }

    private async Task<Dictionary<string, Role>> SyncRolesAsync(
        SystemSeedData seed,
        Dictionary<string, Permission> permissions,
        CancellationToken ct)
    {
        var roles = await db.Roles.Include(r => r.RolePermissions).ToListAsync(ct);
        var byCode = roles.ToDictionary(r => r.Code, StringComparer.OrdinalIgnoreCase);

        foreach (var item in seed.Roles)
        {
            var permissionIds = item.Permissions.Select(code => permissions[code].Id).ToList();
            if (!byCode.TryGetValue(item.Code, out var role))
            {
                role = Role.Create(item.Code, item.Name, item.Description, item.IsSystem);
                role.SetPermissions(permissionIds);
                db.Roles.Add(role);
                byCode[item.Code] = role;
                logger.LogInformation("Seed vai trò mới {Role}.", item.Code);
            }
            else if (item.IsSystem)
            {
                role.SetSystem(true);
                role.SetPermissions(permissionIds);
            }
        }

        // BR-SYS-06: ADMIN luôn có toàn bộ quyền.
        if (byCode.TryGetValue(RoleCodes.Admin, out var admin))
            admin.SetPermissions(permissions.Values.Select(p => p.Id));

        return byCode;
    }

    private async Task SyncUsersAsync(SystemSeedData seed, Dictionary<string, Role> roles, CancellationToken ct)
    {
        var password = demoOptions.Value.Password;
        var users = await db.Users.Include(u => u.UserRoles).ToListAsync(ct);
        var byUsername = users.ToDictionary(u => u.Username, StringComparer.OrdinalIgnoreCase);

        foreach (var item in seed.Users)
        {
            if (!byUsername.TryGetValue(item.Username, out var user))
            {
                user = User.Create(item.Username, item.FullName, item.Email, item.Phone, passwordHasher.Hash(password), item.IsDemoAccount);
                db.Users.Add(user);
                byUsername[item.Username] = user;
                logger.LogInformation("Seed tài khoản mới {Username}.", item.Username);
            }
            else if (user.IsDemoAccount && !passwordHasher.Verify(password, user.PasswordHash))
            {
                user.SetDemoPassword(passwordHasher.Hash(password));
                logger.LogInformation("Đặt lại mật khẩu tài khoản demo {Username} theo DEMO_PASSWORD.", item.Username);
            }

            foreach (var roleCode in item.Roles)
                user.AddRole(roles[roleCode].Id);
        }

        // Tài khoản demo chỉ tồn tại theo seed: project.json bỏ ("enabled": false) thì xóa khỏi DB
        var seeded = seed.Users.Select(u => u.Username).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var user in users.Where(u => u.IsDemoAccount && !seeded.Contains(u.Username)))
        {
            db.Users.Remove(user);
            logger.LogInformation("Xóa tài khoản demo {Username} không còn trong seed.", user.Username);
        }
    }

    private async Task SyncSettingsAsync(SystemSeedData seed, CancellationToken ct)
    {
        var settings = await db.Settings.ToListAsync(ct);
        var byKey = settings.ToDictionary(s => s.Key, StringComparer.OrdinalIgnoreCase);

        foreach (var item in seed.Settings)
        {
            if (byKey.TryGetValue(item.Key, out var setting))
                setting.SetGroup(item.GroupName);
            else
                db.Settings.Add(Setting.Create(item.Key, item.Value, item.GroupName));
        }
    }
}
