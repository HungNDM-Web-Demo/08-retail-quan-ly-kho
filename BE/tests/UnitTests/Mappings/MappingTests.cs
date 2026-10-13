using Application.Common.Models;
using Application.Mappings.AuditLogs;
using Application.Mappings.Roles;
using Application.Mappings.Settings;
using Application.Mappings.Users;
using Domain.Entities.System.AuditLogs;
using Domain.Entities.System.Permissions;
using Domain.Entities.System.Roles;
using Domain.Entities.System.Settings;
using Domain.Entities.System.Users;
using Domain.Enums.System.AuditLogs;
using Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.Mappings;

/// <summary>Ánh xạ viết tay entity → DTO. Dữ liệu đọc qua EF (SQLite trong bộ nhớ) để navigation được nạp như thật.</summary>
public sealed class MappingTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private AppDbContext _db = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);
        await _db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task User_ToDto_CopiesFieldsAndSortsRolesByName()
    {
        var staff = Role.Create("STAFF", "Nhân viên", null, isSystem: true);
        var manager = Role.Create("MANAGER", "Quản lý", null, isSystem: true);
        var user = User.Create("Tran.Mai", "Trần Thị Mai", "mai@example.com", "0909 123 456", "hash", isDemoAccount: true);
        user.SetRoles([manager.Id, staff.Id]);
        _db.AddRange(staff, manager, user);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var loaded = await _db.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).SingleAsync();
        var dto = loaded.ToDto();

        Assert.Equal(user.Id, dto.Id);
        Assert.Equal("tran.mai", dto.Username);
        Assert.Equal("Trần Thị Mai", dto.FullName);
        Assert.Equal("mai@example.com", dto.Email);
        Assert.Equal("0909 123 456", dto.Phone);
        Assert.True(dto.IsActive);
        Assert.True(dto.IsDemoAccount);
        Assert.Null(dto.LastLoginAt);
        Assert.Equal(["Nhân viên", "Quản lý"], dto.Roles.Select(r => r.Name));
        Assert.Equal(["STAFF", "MANAGER"], dto.Roles.Select(r => r.Code));
        Assert.Equal(staff.Id, dto.Roles[0].Id);
    }

    [Fact]
    public async Task Role_ToDto_CountsActiveUsersAndSortsPermissions()
    {
        var viewOrders = Permission.Create("orders.view", "Đơn hàng", "Xem đơn", 10);
        var viewDashboard = Permission.Create("dashboard.view", "Tổng quan", "Xem tổng quan", 1);
        var role = Role.Create("CASHIER", "Thu ngân", "Tính tiền tại quầy");
        role.SetPermissions([viewOrders.Id, viewDashboard.Id]);

        var first = User.Create("thungan1", "Phạm Thu Ngân", null, null, "hash");
        var second = User.Create("thungan2", "Võ Văn Quầy", null, null, "hash");
        var removed = User.Create("thungan3", "Đã Nghỉ Việc", null, null, "hash");
        foreach (var user in new[] { first, second, removed })
            user.SetRoles([role.Id]);
        removed.IsDeleted = true;

        _db.AddRange(viewOrders, viewDashboard, role, first, second, removed);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var loaded = await _db.Roles
            .Include(r => r.UserRoles)
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .SingleAsync();
        var dto = loaded.ToDto();

        Assert.Equal("CASHIER", dto.Code);
        Assert.Equal("Thu ngân", dto.Name);
        Assert.Equal("Tính tiền tại quầy", dto.Description);
        Assert.False(dto.IsSystem);
        Assert.Equal(2, dto.UserCount);
        Assert.Equal(["dashboard.view", "orders.view"], dto.Permissions);
    }

    [Fact]
    public void User_ToCurrentUser_TakesRolesAndPermissionsFromAccess()
    {
        var user = User.Create("quanly", "Trần Thị Mai", null, null, "hash", isDemoAccount: true);
        var access = new UserAccess(["MANAGER"], ["Quản lý"], ["dashboard.view", "orders.view"], IsSuperAdmin: false);

        var current = user.ToCurrentUser(access);

        Assert.Equal(user.Id, current.Id);
        Assert.Equal("quanly", current.Username);
        Assert.Equal(["MANAGER"], current.Roles);
        Assert.Equal(["Quản lý"], current.RoleNames);
        Assert.Equal(["dashboard.view", "orders.view"], current.Permissions);
        Assert.False(current.IsSuperAdmin);
        Assert.True(current.IsDemoAccount);
    }

    [Fact]
    public void Setting_And_AuditLog_ToDto_CopyFields()
    {
        var setting = Setting.Create("Brand.AppName", "POS Quán Cafe", "Thương hiệu");
        var userId = Guid.NewGuid();
        var log = AuditLog.Create(AuditAction.Update, "Setting", setting.Id.ToString(), userId, "admin", "127.0.0.1",
            """{"value":"Cũ"}""", """{"value":"Mới"}""");

        var settingDto = setting.ToDto();
        var logDto = log.ToDto();

        Assert.Equal(("Brand.AppName", "POS Quán Cafe", "Thương hiệu"), (settingDto.Key, settingDto.Value, settingDto.GroupName));
        Assert.Equal(AuditAction.Update, logDto.Action);
        Assert.Equal("Setting", logDto.EntityName);
        Assert.Equal(setting.Id.ToString(), logDto.EntityId);
        Assert.Equal(userId, logDto.UserId);
        Assert.Equal("admin", logDto.Username);
        Assert.Equal("""{"value":"Cũ"}""", logDto.OldValues);
        Assert.Equal("""{"value":"Mới"}""", logDto.NewValues);
        Assert.Equal("127.0.0.1", logDto.IpAddress);
    }
}
