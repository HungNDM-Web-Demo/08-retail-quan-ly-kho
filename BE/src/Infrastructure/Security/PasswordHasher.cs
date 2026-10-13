using System.Security.Cryptography;
using Application.Interfaces.Services.Auth;

namespace Infrastructure.Security;

/// <summary>
/// Băm mật khẩu bằng PBKDF2-SHA256, salt ngẫu nhiên 16 byte cho mỗi lần băm.
/// Lưu dạng <c>PBKDF2-SHA256${số vòng}${salt base64}${hash base64}</c> trong cột PasswordHash.
/// </summary>
public sealed class PasswordHasher : IPasswordHasher
{
    private const string Algorithm = "PBKDF2-SHA256";
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int MaxIterations = 10_000_000;

    public string Hash(string password)
    {
        ArgumentNullException.ThrowIfNull(password);

        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return string.Join('$', Algorithm, Iterations, Convert.ToBase64String(salt), Convert.ToBase64String(key));
    }

    public bool Verify(string password, string passwordHash)
    {
        if (password is null || string.IsNullOrEmpty(passwordHash))
            return false;

        var parts = passwordHash.Split('$');
        if (parts.Length != 4
            || parts[0] != Algorithm
            || !int.TryParse(parts[1], out var iterations)
            || iterations is < 1 or > MaxIterations)
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            if (expected.Length == 0)
                return false;

            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
