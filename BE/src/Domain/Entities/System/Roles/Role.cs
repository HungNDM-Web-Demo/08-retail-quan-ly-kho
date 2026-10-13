using Domain.Base;
using Domain.Common;
using Domain.Entities.System.Users;

namespace Domain.Entities.System.Roles;

/// <summary>Vai trò (<c>System_Roles</c>). Xóa mềm.</summary>
public class Role : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int CodeMaxLength = 50;
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 500;

    private readonly List<RolePermission> _rolePermissions = [];
    private readonly List<UserRole> _userRoles = [];

    private Role()
    {
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    /// <summary>Vai trò hệ thống (khai báo trong file seed) không được xóa (BR-SYS-06).</summary>
    public bool IsSystem { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public IReadOnlyCollection<RolePermission> RolePermissions => _rolePermissions;
    public IReadOnlyCollection<UserRole> UserRoles => _userRoles;

    public static Role Create(string code, string name, string? description, bool isSystem = false)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new DomainException("Mã vai trò không được để trống.");

        var role = new Role { Code = NormalizeCode(code), IsSystem = isSystem };
        role.Update(name, description);
        return role;
    }

    /// <summary>Chuẩn hóa mã vai trò: bỏ khoảng trắng hai đầu, viết hoa.</summary>
    public static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();

    public void Update(string name, string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Tên vai trò không được để trống.");

        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }

    public void SetSystem(bool isSystem) => IsSystem = isSystem;

    /// <summary>Gán đúng danh sách quyền: thêm quyền mới, gỡ quyền không còn trong danh sách.</summary>
    public void SetPermissions(IEnumerable<Guid> permissionIds)
    {
        var target = permissionIds.ToHashSet();
        _rolePermissions.RemoveAll(rp => !target.Contains(rp.PermissionId));
        foreach (var permissionId in target.Where(id => _rolePermissions.All(rp => rp.PermissionId != id)))
            _rolePermissions.Add(new RolePermission(Id, permissionId));
    }

    /// <summary>BR-SYS-06: không xóa vai trò hệ thống; BR-SYS-07: không xóa vai trò đang gán cho tài khoản.</summary>
    public void EnsureCanBeDeleted(int assignedUserCount)
    {
        if (IsSystem)
            throw new DomainException("Không xóa được vai trò hệ thống.");

        if (assignedUserCount > 0)
        {
            throw new DomainException(
                $"Vai trò đang được gán cho {assignedUserCount} tài khoản. Gỡ vai trò khỏi các tài khoản này trước khi xóa.",
                new Dictionary<string, object?> { ["userCount"] = assignedUserCount });
        }
    }
}
