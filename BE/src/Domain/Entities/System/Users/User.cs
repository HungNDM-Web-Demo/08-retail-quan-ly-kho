using Domain.Base;
using Domain.Common;

namespace Domain.Entities.System.Users;

/// <summary>Tài khoản đăng nhập (bảng <c>System_Users</c>).</summary>
public class User : BaseEntity, ICreationTracked, IModificationTracked, ISoftDelete
{
    public const int UsernameMinLength = 3;
    public const int UsernameMaxLength = 50;
    public const int PasswordHashMaxLength = 256;
    public const int FullNameMaxLength = 150;
    public const int EmailMaxLength = 150;
    public const int PhoneMaxLength = 20;
    public const int AvatarUrlMaxLength = 500;

    /// <summary>BR-SYS-03: số lần đăng nhập sai liên tiếp trước khi tạm khóa.</summary>
    public const int MaxFailedLoginAttempts = 5;

    /// <summary>BR-SYS-03: thời gian tạm khóa đăng nhập.</summary>
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(5);

    private readonly List<UserRole> _userRoles = [];
    private readonly List<UserRefreshToken> _refreshTokens = [];

    private User()
    {
    }

    public string Username { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? Phone { get; private set; }
    public string? AvatarUrl { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsDemoAccount { get; private set; }
    public DateTime? LastLoginAt { get; private set; }

    /// <summary>Số lần đăng nhập sai liên tiếp, tính từ lần đăng nhập đúng hoặc lần tạm khóa gần nhất.</summary>
    public int FailedLoginCount { get; private set; }

    /// <summary>Thời điểm (UTC) hết tạm khóa đăng nhập; null là không bị tạm khóa.</summary>
    public DateTime? LockoutEndAt { get; private set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public IReadOnlyCollection<UserRole> UserRoles => _userRoles;
    public IReadOnlyCollection<UserRefreshToken> RefreshTokens => _refreshTokens;

    public static User Create(
        string username,
        string fullName,
        string? email,
        string? phone,
        string passwordHash,
        bool isDemoAccount = false)
    {
        if (string.IsNullOrWhiteSpace(username))
            throw new DomainException("Tên đăng nhập không được để trống.");

        var user = new User
        {
            Username = NormalizeUsername(username),
            PasswordHash = passwordHash,
            IsDemoAccount = isDemoAccount
        };
        user.UpdateProfile(fullName, email, phone);
        return user;
    }

    /// <summary>Chuẩn hóa tên đăng nhập để so khớp: bỏ khoảng trắng hai đầu, viết thường.</summary>
    public static string NormalizeUsername(string username) => username.Trim().ToLowerInvariant();

    public void UpdateProfile(string fullName, string? email, string? phone)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            throw new DomainException("Họ tên không được để trống.");

        FullName = fullName.Trim();
        Email = TrimToNull(email);
        Phone = TrimToNull(phone);
    }

    public void SetAvatar(string? avatarUrl) => AvatarUrl = TrimToNull(avatarUrl);

    /// <summary>Đổi mật khẩu (người dùng tự đổi hoặc quản trị viên đặt lại). BR-SYS-05: chặn với tài khoản demo.</summary>
    public void ChangePassword(string newPasswordHash)
    {
        if (IsDemoAccount)
            throw new DomainException("Tài khoản demo không được đổi mật khẩu.");

        PasswordHash = newPasswordHash;
        ClearLockout();
    }

    /// <summary>Đồng bộ mật khẩu tài khoản demo theo <c>DEMO_PASSWORD</c>. Chỉ dùng khi seed.</summary>
    public void SetDemoPassword(string passwordHash)
    {
        if (!IsDemoAccount)
            throw new DomainException("Chỉ đặt mật khẩu demo cho tài khoản demo.");

        PasswordHash = passwordHash;
    }

    /// <summary>Khóa hoặc mở khóa tài khoản. BR-SYS-05: không khóa tài khoản demo; BR-SYS-10: không tự khóa mình.</summary>
    public void SetActive(bool isActive, Guid? actorId)
    {
        if (!isActive)
        {
            if (IsDemoAccount)
                throw new DomainException("Tài khoản demo không được khóa.");
            if (actorId == Id)
                throw new DomainException("Bạn không thể tự khóa tài khoản của mình.");
        }

        IsActive = isActive;
        if (isActive)
            ClearLockout();
    }

    /// <summary>Kiểm tra trước khi xóa. BR-SYS-05: không xóa tài khoản demo; BR-SYS-10: không tự xóa mình.</summary>
    public void EnsureCanBeDeleted(Guid? actorId)
    {
        if (IsDemoAccount)
            throw new DomainException("Tài khoản demo không được xóa.");
        if (actorId == Id)
            throw new DomainException("Bạn không thể tự xóa tài khoản của mình.");
    }

    public bool IsLockedOut(DateTime nowUtc) => LockoutEndAt.HasValue && LockoutEndAt.Value > nowUtc;

    /// <summary>
    /// Ghi nhận một lần đăng nhập sai. Đủ <see cref="MaxFailedLoginAttempts"/> lần liên tiếp thì tạm khóa
    /// <see cref="LockoutDuration"/> (BR-SYS-03); hết khóa thì đếm lại từ đầu.
    /// </summary>
    public void RegisterFailedLogin(DateTime nowUtc)
    {
        if (LockoutEndAt.HasValue && LockoutEndAt.Value <= nowUtc)
            ClearLockout();

        FailedLoginCount++;
        if (FailedLoginCount >= MaxFailedLoginAttempts)
        {
            LockoutEndAt = nowUtc.Add(LockoutDuration);
            FailedLoginCount = 0;
        }
    }

    public void RegisterSuccessfulLogin(DateTime nowUtc)
    {
        ClearLockout();
        LastLoginAt = nowUtc;
    }

    /// <summary>Gán đúng danh sách vai trò: thêm vai trò mới, gỡ vai trò không còn trong danh sách.</summary>
    public void SetRoles(IEnumerable<Guid> roleIds)
    {
        var target = roleIds.ToHashSet();
        _userRoles.RemoveAll(ur => !target.Contains(ur.RoleId));
        foreach (var roleId in target.Where(id => _userRoles.All(ur => ur.RoleId != id)))
            _userRoles.Add(new UserRole(Id, roleId));
    }

    /// <summary>Gán thêm vai trò nếu chưa có, giữ nguyên các vai trò khác.</summary>
    public void AddRole(Guid roleId)
    {
        if (_userRoles.All(ur => ur.RoleId != roleId))
            _userRoles.Add(new UserRole(Id, roleId));
    }

    private void ClearLockout()
    {
        FailedLoginCount = 0;
        LockoutEndAt = null;
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
