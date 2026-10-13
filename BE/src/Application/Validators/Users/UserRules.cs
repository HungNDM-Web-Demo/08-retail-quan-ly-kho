using FluentValidation;

namespace Application.Validators.Users;

internal static class UserRules
{
    /// <summary>Tài khoản phải có ít nhất một vai trò; id không rỗng.</summary>
    public static IRuleBuilderOptions<T, IReadOnlyList<Guid>> ValidRoleIds<T>(this IRuleBuilder<T, IReadOnlyList<Guid>> rule) =>
        rule.NotEmpty().WithMessage("Chọn ít nhất một vai trò.")
            .Must(ids => ids.All(id => id != Guid.Empty)).WithMessage("Vai trò không hợp lệ.");
}
