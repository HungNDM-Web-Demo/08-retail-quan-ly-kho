namespace Infrastructure.Persistence.Seeders;

// Hình dạng của system.json và project.json. Trường để null nghĩa là "không khai báo".
// Các trường chỉ FE dùng ($comment, homeAfterLogin) được bỏ qua.

internal sealed class SeedFile
{
    public List<SeedFilePermission>? Permissions { get; init; }
    public List<SeedFileRole>? Roles { get; init; }
    public Dictionary<string, List<string>>? RoleGrants { get; init; }
    public List<SeedFileUser>? Users { get; init; }
    public List<SeedFileSetting>? Settings { get; init; }
}

internal sealed class SeedFilePermission
{
    public string? Code { get; init; }
    public string? GroupName { get; init; }
    public string? Name { get; init; }
    public int SortOrder { get; init; }
}

internal sealed class SeedFileRole
{
    public string? Code { get; init; }
    public string? Name { get; init; }
    public string? Description { get; init; }
    public bool? IsSystem { get; init; }
    public List<string>? Permissions { get; init; }
}

internal sealed class SeedFileUser
{
    public string? Username { get; init; }
    public string? FullName { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public List<string>? Roles { get; init; }
    public bool? IsDemoAccount { get; init; }
    public bool? QuickLogin { get; init; }
    public int? SortOrder { get; init; }
    public string? Description { get; init; }
    /// <summary>project.json đặt <c>false</c> để bỏ một tài khoản của nền (dự án không dùng vai trò đó).</summary>
    public bool? Enabled { get; init; }
}

internal sealed class SeedFileSetting
{
    public string? Key { get; init; }
    public string? Value { get; init; }
    public string? GroupName { get; init; }
}
