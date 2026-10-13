using Application.Common.Exceptions;
using Application.DTOs.Auth;
using Application.DTOs.Demo;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Demo;
using Domain.Entities.System.Roles;
using Domain.Entities.System.Users;
using Infrastructure.Implementations.Services.Auth;
using Infrastructure.Persistence.Seeders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Demo;

/// <summary>
/// Đăng nhập nhanh và đặt lại dữ liệu demo. Danh sách tài khoản demo, thứ tự và mô tả lấy từ file seed đã ghép
/// (<see cref="SystemSeedData"/>); họ tên, tên vai trò lấy từ DB.
/// </summary>
public sealed class DemoService(
    IGenericRepository<User> users,
    IGenericRepository<Role> roles,
    AuthSessionIssuer sessionIssuer,
    DemoDataResetter demoDataResetter,
    TimeProvider timeProvider) : IDemoService
{
    public async Task<IReadOnlyList<DemoAccount>> GetAccountsAsync(CancellationToken ct = default)
    {
        var accounts = SystemSeedData.Embedded.QuickLoginUsers.ToList();
        var usernames = accounts.Select(a => a.Username).ToList();
        var roleCodes = accounts.SelectMany(a => a.Roles).Distinct().ToList();

        var activeUsers = await users.QueryNoTracking()
            .Where(u => usernames.Contains(u.Username) && u.IsActive)
            .ToDictionaryAsync(u => u.Username, StringComparer.OrdinalIgnoreCase, ct);
        var roleNames = await roles.QueryNoTracking()
            .Where(r => roleCodes.Contains(r.Code))
            .ToDictionaryAsync(r => r.Code, r => r.Name, StringComparer.OrdinalIgnoreCase, ct);
        var seedRoleNames = SystemSeedData.Embedded.Roles.ToDictionary(r => r.Code, r => r.Name, StringComparer.OrdinalIgnoreCase);

        return accounts
            .Where(a => activeUsers.ContainsKey(a.Username))
            .Select(a =>
            {
                var roleCode = a.Roles[0];
                return new DemoAccount
                {
                    Username = a.Username,
                    FullName = activeUsers[a.Username].FullName,
                    RoleCode = roleCode,
                    RoleName = roleNames.GetValueOrDefault(roleCode) ?? seedRoleNames.GetValueOrDefault(roleCode) ?? roleCode,
                    Description = a.Description
                };
            })
            .ToList();
    }

    public async Task<AuthResponse> LoginAsAsync(LoginAsRequest request, CancellationToken ct = default)
    {
        var roleCode = Role.NormalizeCode(request.RoleCode);
        var candidates = SystemSeedData.Embedded.QuickLoginUsers
            .Where(a => a.Roles.Contains(roleCode, StringComparer.OrdinalIgnoreCase))
            .Select(a => a.Username)
            .ToList();

        foreach (var username in candidates)
        {
            var user = await users.Query().FirstOrDefaultAsync(u => u.Username == username && u.IsActive, ct);
            if (user is null)
                continue;

            // Đăng nhập nhanh không cần mật khẩu, nên cũng bỏ qua tạm khóa do nhập sai mật khẩu.
            user.RegisterSuccessfulLogin(timeProvider.GetUtcNow().UtcDateTime);
            return await sessionIssuer.StartSessionAsync(user, "demo", ct);
        }

        throw new NotFoundException($"Không có tài khoản demo cho vai trò {roleCode}.");
    }

    public Task ResetAsync(CancellationToken ct = default) => demoDataResetter.ResetAsync(ct);
}
