using Application.DTOs.Settings;
using Application.Validators.Common;
using Domain.Entities.System.Settings;
using FluentValidation;

namespace Application.Validators.Settings;

public sealed class UpdateSettingsRequestValidator : AppValidator<UpdateSettingsRequest>
{
    public UpdateSettingsRequestValidator()
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("Không có cài đặt nào để lưu.")
            .Must(items => items.Select(i => i.Key?.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() == items.Count)
            .WithMessage("Một khóa cài đặt xuất hiện nhiều lần.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Key)
                .NotEmpty().WithMessage("Khóa cài đặt không được để trống.")
                .MaximumLength(Setting.KeyMaxLength).WithMessage($"Khóa cài đặt tối đa {Setting.KeyMaxLength} ký tự.");

            item.RuleFor(i => i.Value)
                .NotNull().WithMessage("Giá trị không được để trống.")
                .MaximumLength(Setting.ValueMaxLength).WithMessage($"Giá trị tối đa {Setting.ValueMaxLength} ký tự.");
        });
    }
}
