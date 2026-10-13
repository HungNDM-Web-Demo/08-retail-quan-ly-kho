using Application.DTOs.Auth;
using Application.Validators.Common;
using FluentValidation;

namespace Application.Validators.Auth;

public sealed class RefreshRequestValidator : AppValidator<RefreshRequest>
{
    public RefreshRequestValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("Thiếu refresh token.")
            .MaximumLength(RefreshTokenRules.MaxLength).WithMessage("Refresh token không hợp lệ.");
    }
}
