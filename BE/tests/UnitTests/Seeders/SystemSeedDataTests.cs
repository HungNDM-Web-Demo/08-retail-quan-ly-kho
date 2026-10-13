using System.Text.Json;
using Application.Constants;
using Infrastructure.Persistence.Seeders;

namespace UnitTests.Seeders;

public class SystemSeedDataTests
{
    private const string SystemJson = """
        {
          "$comment": "bản rút gọn của system.json",
          "permissions": [
            { "code": "dashboard.view", "groupName": "Tổng quan", "name": "Xem tổng quan", "sortOrder": 10 },
            { "code": "users.view", "groupName": "Tài khoản", "name": "Xem tài khoản", "sortOrder": 110 }
          ],
          "roles": [
            { "code": "ADMIN", "name": "Quản trị viên", "description": "Toàn quyền", "isSystem": true, "permissions": ["*"] },
            { "code": "MANAGER", "name": "Quản lý", "description": "Nghiệp vụ", "isSystem": true, "permissions": ["dashboard.view"] },
            { "code": "STAFF", "name": "Nhân viên", "isSystem": true, "permissions": ["dashboard.view"] }
          ],
          "users": [
            { "username": "admin", "fullName": "Nguyễn Minh Quân", "email": "admin@example.com", "roles": ["ADMIN"], "isDemoAccount": true, "quickLogin": true, "sortOrder": 1, "description": "Toàn quyền" },
            { "username": "nhanvien", "fullName": "Lê Hoàng Nam", "phone": "0123456783", "roles": ["STAFF"], "isDemoAccount": true, "quickLogin": true, "sortOrder": 3, "description": "Thao tác hằng ngày" }
          ],
          "settings": [
            { "key": "Brand.AppName", "value": "Quản lý Kho", "groupName": "Thương hiệu" },
            { "key": "Company.Name", "value": "Công ty ABC", "groupName": "Doanh nghiệp" }
          ]
        }
        """;

    private const string ProjectJson = """
        {
          "permissions": [
            { "code": "orders.view", "groupName": "Đơn hàng", "name": "Xem đơn", "sortOrder": 200 },
            { "code": "orders.cancel", "groupName": "Đơn hàng", "name": "Hủy đơn", "sortOrder": 201 }
          ],
          "roles": [
            { "code": "CASHIER", "name": "Thu ngân", "description": "Tính tiền", "isSystem": true, "permissions": ["orders.view"] },
            { "code": "STAFF", "name": "Phục vụ", "isSystem": false }
          ],
          "roleGrants": {
            "MANAGER": ["orders.view", "orders.cancel"],
            "staff": ["orders.view"]
          },
          "users": [
            { "username": "thungan", "fullName": "Phạm Thu Ngân", "roles": ["CASHIER"], "quickLogin": true, "sortOrder": 2, "description": "Bán hàng tại quầy" },
            { "username": "NhanVien", "fullName": "Lê Văn Phục Vụ", "description": "Gọi món, phục vụ bàn" }
          ],
          "settings": [
            { "key": "Brand.AppName", "value": "POS Quán Cafe" },
            { "key": "Store.Name", "value": "Cafe Sân Vườn", "groupName": "Cửa hàng" }
          ],
          "homeAfterLogin": "/pos"
        }
        """;

    [Fact]
    public void Merge_AdminStar_ExpandsToEveryPermissionIncludingProject()
    {
        var data = Merge(SystemJson, ProjectJson);

        var admin = data.Roles.Single(r => r.Code == "ADMIN");
        Assert.Equal(["dashboard.view", "users.view", "orders.view", "orders.cancel"], admin.Permissions);
    }

    [Fact]
    public void Merge_RoleGrants_AddPermissionsToExistingRoles()
    {
        var data = Merge(SystemJson, ProjectJson);

        Assert.Equal(["dashboard.view", "orders.view", "orders.cancel"], data.Roles.Single(r => r.Code == "MANAGER").Permissions);
        Assert.Equal(["dashboard.view", "orders.view"], data.Roles.Single(r => r.Code == "STAFF").Permissions);
    }

    [Fact]
    public void Merge_ProjectRoleWithSameCode_OverridesNameButKeepsIsSystem()
    {
        var data = Merge(SystemJson, ProjectJson);

        var staff = data.Roles.Single(r => r.Code == "STAFF");
        Assert.Equal("Phục vụ", staff.Name);
        Assert.True(staff.IsSystem);

        var cashier = data.Roles.Single(r => r.Code == "CASHIER");
        Assert.Equal(["orders.view"], cashier.Permissions);
        Assert.Equal(4, data.Roles.Count);
    }

    [Fact]
    public void Merge_ProjectUserWithSameUsername_OverridesOnlyDeclaredFields()
    {
        var data = Merge(SystemJson, ProjectJson);

        var staff = data.Users.Single(u => u.Username == "nhanvien");
        Assert.Equal("Lê Văn Phục Vụ", staff.FullName);
        Assert.Equal("Gọi món, phục vụ bàn", staff.Description);
        Assert.Equal("0123456783", staff.Phone);
        Assert.Equal(["STAFF"], staff.Roles);
        Assert.True(staff.QuickLogin);
        Assert.Equal(3, staff.SortOrder);
        Assert.Equal(3, data.Users.Count);
    }

    [Fact]
    public void Merge_NewProjectUser_IsDemoAccountAndOrderedBySortOrder()
    {
        var data = Merge(SystemJson, ProjectJson);

        var cashier = data.Users.Single(u => u.Username == "thungan");
        Assert.True(cashier.IsDemoAccount);
        Assert.Equal(["admin", "thungan", "nhanvien"], data.QuickLoginUsers.Select(u => u.Username));
    }

    [Fact]
    public void Merge_ProjectUserEnabledFalse_RemovesBaseUser()
    {
        var project = """{ "users": [ { "username": "quanly", "enabled": false }, { "username": "khongco", "enabled": false } ] }""";

        var data = Merge(SystemJson, project);

        Assert.Equal(["admin", "nhanvien"], data.Users.Select(u => u.Username));
        Assert.Equal(["admin", "nhanvien"], data.QuickLoginUsers.Select(u => u.Username));
    }

    [Fact]
    public void Merge_Settings_ProjectOverridesValueAndAddsNewKeys()
    {
        var data = Merge(SystemJson, ProjectJson);

        var appName = data.Settings.Single(s => s.Key == "Brand.AppName");
        Assert.Equal("POS Quán Cafe", appName.Value);
        Assert.Equal("Thương hiệu", appName.GroupName);
        Assert.Contains(data.Settings, s => s is { Key: "Store.Name", Value: "Cafe Sân Vườn", GroupName: "Cửa hàng" });
        Assert.Equal(3, data.Settings.Count);
    }

    [Fact]
    public void Merge_WithoutProjectFile_UsesSystemOnly()
    {
        var data = SystemSeedData.Merge(Parse(SystemJson), null);

        Assert.Equal(2, data.Permissions.Count);
        Assert.Equal(["dashboard.view", "users.view"], data.Roles.Single(r => r.Code == "ADMIN").Permissions);
    }

    [Theory]
    [InlineData("""{ "roleGrants": { "MANAGER": ["khong.co"] } }""", "khong.co")]
    [InlineData("""{ "roleGrants": { "KHONG_CO": ["dashboard.view"] } }""", "KHONG_CO")]
    [InlineData("""{ "users": [ { "username": "x", "fullName": "X", "roles": ["KHONG_CO"] } ] }""", "KHONG_CO")]
    [InlineData("""{ "users": [ { "username": "y", "fullName": "Y" } ] }""", "chưa có vai trò")]
    [InlineData("""{ "settings": [ { "key": "Moi.Khoa" } ] }""", "Moi.Khoa")]
    public void Merge_InvalidProjectData_ThrowsClearError(string projectJson, string expectedInMessage)
    {
        var error = Assert.Throws<InvalidOperationException>(() => Merge(SystemJson, projectJson));

        Assert.Contains(expectedInMessage, error.Message);
    }

    [Fact]
    public void Embedded_TemplateSeed_HasBaseRolesAndQuickLoginAccounts()
    {
        var data = SystemSeedData.Embedded;

        var admin = data.Roles.Single(r => r.Code == RoleCodes.Admin);
        Assert.Equal(data.Permissions.Select(p => p.Code), admin.Permissions);
        Assert.All(data.Roles.Where(r => r.Code is RoleCodes.Admin or RoleCodes.Manager or RoleCodes.Staff), r => Assert.True(r.IsSystem));
        Assert.Equal(["admin", "quanly", "nhanvien"], data.QuickLoginUsers.Select(u => u.Username));
        Assert.All(data.QuickLoginUsers, u => Assert.False(string.IsNullOrWhiteSpace(u.Description)));
    }

    private static SystemSeedData Merge(string systemJson, string projectJson) =>
        SystemSeedData.Merge(Parse(systemJson), Parse(projectJson));

    private static SeedFile Parse(string json) => JsonSerializer.Deserialize<SeedFile>(json, SeedJson.Options)!;
}
