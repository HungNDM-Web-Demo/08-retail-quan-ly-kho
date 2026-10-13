using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Infrastructure.Extensions;

internal static class ServiceRegistrationExtensions
{
    private const string ImplementationsNamespace = "Infrastructure.Implementations.Services";
    private const string InterfacesNamespace = "Application.Interfaces";
    private const string BackgroundJobsNamespace = "Infrastructure.BackgroundJobs";

    /// <summary>
    /// Đăng ký scoped mọi class trong <c>Infrastructure.Implementations.Services.*</c> theo interface của nó
    /// thuộc <c>Application.Interfaces.*</c>. Service mới chỉ cần đặt đúng thư mục, không phải sửa DI.
    /// Interface đã đăng ký thủ công trước đó thì giữ nguyên (TryAdd).
    /// </summary>
    public static IServiceCollection AddScannedServices(this IServiceCollection services, Assembly assembly)
    {
        var implementations = assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false, IsGenericTypeDefinition: false })
            .Where(t => t.Namespace?.StartsWith(ImplementationsNamespace, StringComparison.Ordinal) == true);

        foreach (var implementation in implementations)
        {
            var serviceInterfaces = implementation.GetInterfaces()
                .Where(i => !i.IsGenericTypeDefinition)
                .Where(i => i.Namespace?.StartsWith(InterfacesNamespace, StringComparison.Ordinal) == true);

            foreach (var serviceInterface in serviceInterfaces)
                services.TryAddScoped(serviceInterface, implementation);
        }

        return services;
    }

    /// <summary>
    /// Đăng ký mọi job nền (<see cref="IHostedService"/>, vd kế thừa <see cref="BackgroundService"/>) trong
    /// <c>Infrastructure.BackgroundJobs</c>. Job mới chỉ cần đặt đúng thư mục, không phải sửa DI. Tương đương
    /// <c>AddHostedService</c>: mỗi job đăng ký một lần dù gọi nhiều lần.
    /// </summary>
    public static IServiceCollection AddScannedBackgroundJobs(this IServiceCollection services, Assembly assembly)
    {
        var jobs = assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false, IsGenericTypeDefinition: false })
            .Where(t => t.Namespace?.StartsWith(BackgroundJobsNamespace, StringComparison.Ordinal) == true)
            .Where(t => typeof(IHostedService).IsAssignableFrom(t));

        foreach (var job in jobs)
            services.TryAddEnumerable(ServiceDescriptor.Singleton(typeof(IHostedService), job));

        return services;
    }
}
