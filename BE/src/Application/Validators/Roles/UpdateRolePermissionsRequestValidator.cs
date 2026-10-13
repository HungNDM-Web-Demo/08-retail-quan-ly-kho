using Application.DTOs.Roles;
using Application.Validators.Common;

namespace Application.Validators.Roles;

public sealed class UpdateRolePermissionsRequestValidator : AppValidator<UpdateRolePermissionsRequest>
{
    public UpdateRolePermissionsRequestValidator()
    {
        RuleFor(x => x.Permissions).ValidPermissionCodes();
    }
}
