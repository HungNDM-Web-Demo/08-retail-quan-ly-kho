using Domain.Entities.System.Users;

namespace UnitTests.Users;

/// <summary>BR-SYS-03 ở mức entity: sai 5 lần liên tiếp thì tạm khóa 5 phút.</summary>
public class UserLockoutTests
{
    private static readonly DateTime Now = new(2026, 10, 13, 2, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void FourFailedLogins_DoNotLock()
    {
        var user = CreateUser();

        for (var i = 0; i < 4; i++)
            user.RegisterFailedLogin(Now);

        Assert.False(user.IsLockedOut(Now));
        Assert.Equal(4, user.FailedLoginCount);
    }

    [Fact]
    public void FifthFailedLogin_LocksForFiveMinutes()
    {
        var user = CreateUser();

        for (var i = 0; i < User.MaxFailedLoginAttempts; i++)
            user.RegisterFailedLogin(Now);

        Assert.True(user.IsLockedOut(Now));
        Assert.True(user.IsLockedOut(Now.AddMinutes(4).AddSeconds(59)));
        Assert.False(user.IsLockedOut(Now.AddMinutes(5)));
        Assert.Equal(Now.AddMinutes(5), user.LockoutEndAt);
    }

    [Fact]
    public void AfterLockoutExpires_CountingStartsAgain()
    {
        var user = CreateUser();
        for (var i = 0; i < User.MaxFailedLoginAttempts; i++)
            user.RegisterFailedLogin(Now);

        var later = Now.AddMinutes(6);
        user.RegisterFailedLogin(later);

        Assert.False(user.IsLockedOut(later));
        Assert.Equal(1, user.FailedLoginCount);
        Assert.Null(user.LockoutEndAt);
    }

    [Fact]
    public void SuccessfulLogin_ResetsFailedCount()
    {
        var user = CreateUser();
        for (var i = 0; i < 4; i++)
            user.RegisterFailedLogin(Now);

        user.RegisterSuccessfulLogin(Now);
        user.RegisterFailedLogin(Now);

        Assert.Equal(1, user.FailedLoginCount);
        Assert.False(user.IsLockedOut(Now));
        Assert.Equal(Now, user.LastLoginAt);
    }

    private static User CreateUser() => User.Create("kiemthu", "Người Kiểm Thử", null, null, "hash");
}
