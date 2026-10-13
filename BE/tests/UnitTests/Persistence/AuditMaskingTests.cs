using Infrastructure.Persistence.Interceptors;

namespace UnitTests.Persistence;

/// <summary>Nhật ký thao tác không ghi giá trị cột bí mật: tên chứa <c>Password</c> hoặc kết thúc bằng <c>TokenHash</c>, <c>Secret</c>.</summary>
public class AuditMaskingTests
{
    [Theory]
    [InlineData("PasswordHash", true)]
    [InlineData("DemoPassword", true)]
    [InlineData("RefreshTokenHash", true)]
    [InlineData("TokenHash", true)]
    [InlineData("ClientSecret", true)]
    [InlineData("Url", false)]
    [InlineData("Username", false)]
    [InlineData("SecretQuestion", false)]
    public void IsMasked_ByPropertyName(string propertyName, bool expected) =>
        Assert.Equal(expected, AuditSaveChangesInterceptor.IsMasked(propertyName));
}
