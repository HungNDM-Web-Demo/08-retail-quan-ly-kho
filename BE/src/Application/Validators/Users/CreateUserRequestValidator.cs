using Application.DTOs.Users;
using Application.Validators.Common;

namespace Application.Validators.Users;

public sealed class CreateUserRequestValidator : AppValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Username).ValidUsername();
        RuleFor(x => x.FullName).ValidFullName();
        RuleFor(x => x.Email).OptionalEmail();
        RuleFor(x => x.Phone).OptionalPhone();
        RuleFor(x => x.Password).ValidPassword();
        RuleFor(x => x.RoleIds).ValidRoleIds();
    }
}
