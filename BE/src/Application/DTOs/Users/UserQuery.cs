using Application.Common.Models;

namespace Application.DTOs.Users;

/// <summary>Bộ lọc danh sách tài khoản. <c>search</c> tìm theo tên đăng nhập, họ tên, email, số điện thoại.</summary>
public sealed class UserQuery : PaginationQuery
{
    /// <summary>Chỉ lấy tài khoản có vai trò này.</summary>
    public Guid? RoleId { get; set; }

    /// <summary>true: đang hoạt động, false: đã khóa.</summary>
    public bool? IsActive { get; set; }
}
