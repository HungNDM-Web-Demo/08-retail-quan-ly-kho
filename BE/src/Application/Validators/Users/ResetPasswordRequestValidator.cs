using Application.DTOs.Users;
using Application.Validators.Common;

namespace Application.Validators.Users;

public sealed class ResetPasswordRequestValidator : AppValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.NewPassword).ValidPassword();
    }
}
