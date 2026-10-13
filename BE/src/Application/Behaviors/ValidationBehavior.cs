using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.DependencyInjection;

namespace Application.Behaviors;

/// <summary>
/// Chạy mọi <see cref="IValidator{T}"/> đăng ký cho một request, gom lỗi và ném <see cref="ValidationException"/>.
/// Thay cho pipeline MediatR của ERP: API gọi tự động cho mọi tham số action (ValidationFilter);
/// service hoặc job nền gọi trực tiếp khi nhận dữ liệu không qua controller.
/// </summary>
public sealed class ValidationBehavior(IServiceProvider services)
{
    public async Task ValidateAsync(object request, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validatorType = typeof(IValidator<>).MakeGenericType(request.GetType());
        var validators = services.GetServices(validatorType).OfType<IValidator>().ToList();
        if (validators.Count == 0)
            return;

        var context = new ValidationContext<object>(request);
        var failures = new List<ValidationFailure>();
        foreach (var validator in validators)
        {
            var result = await validator.ValidateAsync(context, ct);
            failures.AddRange(result.Errors);
        }

        if (failures.Count > 0)
            throw new ValidationException(failures);
    }
}
