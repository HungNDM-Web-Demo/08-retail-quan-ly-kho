using Application.DTOs.Auth;
using Application.Validators.Common;
using FluentValidation;

namespace Application.Validators.Auth;

public sealed class ChangePasswordRequestValidator : AppValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Nhập mật khẩu hiện tại.");

        RuleFor(x => x.NewPassword)
            .ValidPassword()
            .NotEqual(x => x.CurrentPassword).WithMessage("Mật khẩu mới phải khác mật khẩu hiện tại.");
    }
}
