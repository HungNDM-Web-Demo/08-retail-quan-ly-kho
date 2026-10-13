using Application.DTOs.Users;
using Application.Validators.Users;

namespace UnitTests.Validators;

/// <summary>BR-SYS-01 (tên đăng nhập) và BR-SYS-02 (mật khẩu).</summary>
public class UserValidatorTests
{
    private static readonly Guid RoleId = Guid.NewGuid();
    private readonly CreateUserRequestValidator _validator = new();

    [Theory]
    [InlineData("abc")]
    [InlineData("nguyen.van_a")]
    [InlineData("user123")]
    public void Username_Valid(string username)
    {
        var result = _validator.Validate(ValidRequest() with { Username = username });

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("ab")]
    [InlineData("Admin")]
    [InlineData("nguyễn")]
    [InlineData("co khoang trang")]
    [InlineData("a-b-c")]
    public void Username_Invalid(string username)
    {
        var result = _validator.Validate(ValidRequest() with { Username = username });

        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateUserRequest.Username));
    }

    [Theory]
    [InlineData("1234567")]
    [InlineData("abcdefgh")]
    [InlineData("12345678")]
    public void Password_TooShortOrMissingLetterOrDigit_Invalid(string password)
    {
        var result = _validator.Validate(ValidRequest() with { Password = password });

        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateUserRequest.Password));
    }

    [Fact]
    public void RoleIds_Empty_Invalid()
    {
        var result = _validator.Validate(ValidRequest() with { RoleIds = [] });

        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateUserRequest.RoleIds));
    }

    [Theory]
    [InlineData("0909 123 456", true)]
    [InlineData("0909123456", true)]
    [InlineData("+84 909 123 456", true)]
    [InlineData("không phải số", false)]
    [InlineData("123", false)]
    public void Phone_Format(string phone, bool valid)
    {
        var result = _validator.Validate(ValidRequest() with { Phone = phone });

        Assert.Equal(valid, result.IsValid);
    }

    private static CreateUserRequest ValidRequest() => new()
    {
        Username = "nhanvien.moi",
        FullName = "Nguyễn Văn Mới",
        Email = "moi@example.com",
        Password = "MatKhau123",
        RoleIds = [RoleId]
    };
}
