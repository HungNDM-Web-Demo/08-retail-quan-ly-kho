using FluentValidation;
using FluentValidation.Results;

namespace Infrastructure.Extensions;

/// <summary>
/// Lỗi dữ liệu gắn với một trường phát hiện ở service (cần đọc DB hoặc trạng thái hiện tại, vd nhóm ngành không tồn tại,
/// lùi bậc thiếu lý do). ExceptionMiddleware trả 400 kèm <c>errors</c> theo tên trường camelCase, giống lỗi của validator.
/// Trùng dữ liệu thì dùng <c>ConflictException</c> (409).
/// </summary>
internal static class FieldErrors
{
    /// <summary>Lỗi của trường <paramref name="field"/> (camelCase, vd <c>reason</c>).</summary>
    public static ValidationException Single(string field, string message) =>
        new([new ValidationFailure(field, message)]);
}
