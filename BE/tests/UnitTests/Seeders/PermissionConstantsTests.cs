using System.Reflection;
using Application.Constants;
using Infrastructure.Persistence.Seeders;

namespace UnitTests.Seeders;

/// <summary>Mã quyền trong Permissions.cs phải có trong file seed (nguồn của SystemSeeder và FE).</summary>
public class PermissionConstantsTests
{
    [Fact]
    public void EveryPermissionConstant_IsDeclaredInSeedFiles()
    {
        var seeded = SystemSeedData.Embedded.Permissions.Select(p => p.Code).ToHashSet();

        var missing = typeof(Permissions)
            .GetNestedTypes(BindingFlags.Public | BindingFlags.Static)
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
            .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .Where(code => !seeded.Contains(code))
            .ToList();

        Assert.Empty(missing);
    }
}
