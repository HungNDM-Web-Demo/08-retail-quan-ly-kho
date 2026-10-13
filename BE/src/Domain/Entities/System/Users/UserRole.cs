using Domain.Entities.System.Roles;

namespace Domain.Entities.System.Users;

/// <summary>Bảng nối tài khoản – vai trò (<c>System_UserRoles</c>), khóa chính (UserId, RoleId).</summary>
public class UserRole
{
    private UserRole()
    {
    }

    public UserRole(Guid userId, Guid roleId)
    {
        UserId = userId;
        RoleId = roleId;
    }

    public Guid UserId { get; private set; }
    public Guid RoleId { get; private set; }

    public User User { get; private set; } = null!;
    public Role Role { get; private set; } = null!;
}
