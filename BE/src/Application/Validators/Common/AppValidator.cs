using FluentValidation;

namespace Application.Validators.Common;

/// <summary>
/// Lớp gốc cho validator của dự án: mỗi trường dừng ở lỗi đầu tiên để thông báo gọn.
/// Thông báo lỗi viết tiếng Việt bằng <c>WithMessage</c>; key lỗi trả về FE là tên trường camelCase.
/// </summary>
public abstract class AppValidator<T> : AbstractValidator<T>
{
    protected AppValidator()
    {
        RuleLevelCascadeMode = CascadeMode.Stop;
    }
}
