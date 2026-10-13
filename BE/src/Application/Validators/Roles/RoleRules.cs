using Domain.Entities.System.Permissions;
using Domain.Entities.System.Roles;
using FluentValidation;

namespace Application.Validators.Roles;

internal static class RoleRules
{
    public static IRuleBuilderOptions<T, string> ValidRoleName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().WithMessage("Tên vai trò không được để trống.")
            .MaximumLength(Role.NameMaxLength).WithMessage($"Tên vai trò tối đa {Role.NameMaxLength} ký tự.");

    public static IRuleBuilderOptions<T, string?> ValidRoleDescription<T>(this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(Role.DescriptionMaxLength).WithMessage($"Mô tả tối đa {Role.DescriptionMaxLength} ký tự.");

    /// <summary>Danh sách mã quyền có thể rỗng; mã không có trong danh mục do service kiểm tra.</summary>
    public static IRuleBuilderOptions<T, IReadOnlyList<string>> ValidPermissionCodes<T>(this IRuleBuilder<T, IReadOnlyList<string>> rule) =>
        rule.NotNull().WithMessage("Thiếu danh sách quyền.")
            .Must(codes => codes.All(c => !string.IsNullOrWhiteSpace(c) && c.Length <= Permission.CodeMaxLength))
            .WithMessage("Mã quyền không hợp lệ.");
}
