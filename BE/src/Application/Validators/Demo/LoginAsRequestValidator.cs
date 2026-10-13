using Application.DTOs.Demo;
using Application.Validators.Common;
using Domain.Entities.System.Roles;
using FluentValidation;

namespace Application.Validators.Demo;

public sealed class LoginAsRequestValidator : AppValidator<LoginAsRequest>
{
    public LoginAsRequestValidator()
    {
        RuleFor(x => x.RoleCode)
            .NotEmpty().WithMessage("Chọn vai trò để đăng nhập.")
            .MaximumLength(Role.CodeMaxLength).WithMessage("Mã vai trò không hợp lệ.");
    }
}
