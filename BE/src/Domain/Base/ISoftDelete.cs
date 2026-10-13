namespace Domain.Base;

/// <summary>
/// Entity xóa mềm. Gọi xóa bình thường qua repository; interceptor đổi thành cập nhật <see cref="IsDeleted"/> = true.
/// AppDbContext tự thêm global query filter để ẩn bản ghi đã xóa.
/// </summary>
public interface ISoftDelete
{
    bool IsDeleted { get; set; }
}
