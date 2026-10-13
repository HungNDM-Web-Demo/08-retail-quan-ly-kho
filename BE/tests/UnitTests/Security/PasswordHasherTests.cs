using Infrastructure.Security;

namespace UnitTests.Security;

public class PasswordHasherTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void Hash_ThenVerify_WithSamePassword_ReturnsTrue()
    {
        var hash = _hasher.Hash("Demo@123");

        Assert.StartsWith("PBKDF2-SHA256$", hash);
        Assert.True(_hasher.Verify("Demo@123", hash));
    }

    [Fact]
    public void Verify_WithWrongPassword_ReturnsFalse()
    {
        var hash = _hasher.Hash("Demo@123");

        Assert.False(_hasher.Verify("demo@123", hash));
        Assert.False(_hasher.Verify(string.Empty, hash));
    }

    [Fact]
    public void Hash_SamePasswordTwice_UsesDifferentSalt()
    {
        var first = _hasher.Hash("Mat-khau-1");
        var second = _hasher.Hash("Mat-khau-1");

        Assert.NotEqual(first, second);
        Assert.True(_hasher.Verify("Mat-khau-1", first));
        Assert.True(_hasher.Verify("Mat-khau-1", second));
    }

    [Fact]
    public void Verify_WithUnicodePassword_Works()
    {
        var hash = _hasher.Hash("Mật khẩu có dấu 123");

        Assert.True(_hasher.Verify("Mật khẩu có dấu 123", hash));
        Assert.False(_hasher.Verify("Mat khau co dau 123", hash));
    }

    [Theory]
    [InlineData("")]
    [InlineData("plain-text-password")]
    [InlineData("PBKDF2-SHA256$abc$c2FsdA==$aGFzaA==")]
    [InlineData("PBKDF2-SHA256$0$c2FsdA==$aGFzaA==")]
    [InlineData("PBKDF2-SHA256$1000$khong-phai-base64$aGFzaA==")]
    [InlineData("SHA1$1000$c2FsdA==$aGFzaA==")]
    public void Verify_WithMalformedHash_ReturnsFalse(string storedHash)
    {
        Assert.False(_hasher.Verify("Demo@123", storedHash));
    }
}
