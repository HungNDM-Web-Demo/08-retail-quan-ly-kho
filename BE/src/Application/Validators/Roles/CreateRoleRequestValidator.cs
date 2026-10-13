using Application.DTOs.Roles;
using Application.Validators.Common;
using Domain.Entities.System.Roles;
using FluentValidation;

namespace Application.Validators.Roles;

public sealed class CreateRoleRequestValidator : AppValidator<CreateRoleRequest>
{
    public CreateRoleRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã vai trò không được để trống.")
            .MaximumLength(Role.CodeMaxLength).WithMessage($"Mã vai trò tối đa {Role.CodeMaxLength} ký tự.")
            .Matches("^[A-Za-z][A-Za-z0-9_]*$")
            .WithMessage("Mã vai trò bắt đầu bằng chữ, chỉ gồm chữ không dấu, số và gạch dưới, vd CASHIER.");

        RuleFor(x => x.Name).ValidRoleName();
        RuleFor(x => x.Description).ValidRoleDescription();
        RuleFor(x => x.Permissions).ValidPermissionCodes();
    }
}
