namespace Application.Interfaces.Services.Auth;

/// <summary>Băm và kiểm tra mật khẩu. Kết quả băm gồm cả thuật toán, số vòng lặp và salt trong một chuỗi.</summary>
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);
}
