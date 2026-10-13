using System.Globalization;
using Application.Behaviors;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class DependencyInjection
{
    /// <summary>
    /// FluentValidation (validator trong Validators/) và ValidationBehavior.
    /// Ánh xạ entity ↔ DTO viết tay trong Mappings/ (extension method), không cần đăng ký.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        // Thông báo mặc định của FluentValidation (khi validator không ghi WithMessage) dùng tiếng Việt.
        ValidatorOptions.Global.LanguageManager.Culture = new CultureInfo("vi");
        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        services.AddScoped<ValidationBehavior>();

        return services;
    }
}
