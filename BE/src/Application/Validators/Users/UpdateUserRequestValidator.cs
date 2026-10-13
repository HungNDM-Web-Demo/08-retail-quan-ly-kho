using Application.DTOs.Users;
using Application.Validators.Common;

namespace Application.Validators.Users;

public sealed class UpdateUserRequestValidator : AppValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(x => x.FullName).ValidFullName();
        RuleFor(x => x.Email).OptionalEmail();
        RuleFor(x => x.Phone).OptionalPhone();
        RuleFor(x => x.RoleIds).ValidRoleIds();
    }
}
