using Application.DTOs.Roles;
using Application.Validators.Common;

namespace Application.Validators.Roles;

public sealed class UpdateRoleRequestValidator : AppValidator<UpdateRoleRequest>
{
    public UpdateRoleRequestValidator()
    {
        RuleFor(x => x.Name).ValidRoleName();
        RuleFor(x => x.Description).ValidRoleDescription();
    }
}
