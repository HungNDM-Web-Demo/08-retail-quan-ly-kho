using Application.DTOs.Auth;
using Application.DTOs.Demo;

namespace Application.Interfaces.Services.Demo;

/// <summary>Tính năng riêng cho demo (UC-SYS-02, 09, 10). Chỉ bật khi <c>DEMO_MODE=true</c>.</summary>
public interface IDemoService
{
    /// <summary>Tài khoản demo cho nút "Đăng nhập nhanh", theo thứ tự hiển thị.</summary>
    Task<IReadOnlyList<DemoAccount>> GetAccountsAsync(CancellationToken ct = default);

    /// <summary>Đăng nhập bằng tài khoản demo đầu tiên có vai trò này, không cần mật khẩu.</summary>
    Task<AuthResponse> LoginAsAsync(LoginAsRequest request, CancellationToken ct = default);

    /// <summary>
    /// Đặt lại dữ liệu demo (BR-SYS-09): xóa dữ liệu nghiệp vụ rồi nạp lại bản mẫu;
    /// giữ tài khoản, vai trò, cài đặt, nhật ký.
    /// </summary>
    Task ResetAsync(CancellationToken ct = default);
}
