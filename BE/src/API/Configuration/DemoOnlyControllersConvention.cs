using API.Filters;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace API.Configuration;

/// <summary>Gỡ các controller gắn <see cref="DemoOnlyAttribute"/> khi <c>DEMO_MODE</c> tắt.</summary>
public sealed class DemoOnlyControllersConvention(bool demoEnabled) : IApplicationModelConvention
{
    public void Apply(ApplicationModel application)
    {
        if (demoEnabled)
            return;

        var demoControllers = application.Controllers
            .Where(c => c.Attributes.OfType<DemoOnlyAttribute>().Any())
            .ToList();
        foreach (var controller in demoControllers)
            application.Controllers.Remove(controller);
    }
}
