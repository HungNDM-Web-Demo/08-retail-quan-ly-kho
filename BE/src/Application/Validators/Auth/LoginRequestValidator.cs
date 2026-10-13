using Application.DTOs.Auth;
using Application.Validators.Common;
using Domain.Entities.System.Users;
using FluentValidation;

namespace Application.Validators.Auth;

public sealed class LoginRequestValidator : AppValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Nhập tên đăng nhập.")
            .MaximumLength(User.UsernameMaxLength).WithMessage("Tên đăng nhập hoặc mật khẩu không đúng");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Nhập mật khẩu.")
            .MaximumLength(ValidationRules.PasswordMaxLength).WithMessage("Tên đăng nhập hoặc mật khẩu không đúng");
    }
}
