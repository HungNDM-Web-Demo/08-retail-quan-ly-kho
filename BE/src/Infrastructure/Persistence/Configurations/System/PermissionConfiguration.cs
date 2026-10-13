using Domain.Entities.System.Permissions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("System_Permissions");

        builder.Property(x => x.Code).HasMaxLength(Permission.CodeMaxLength).IsRequired();
        builder.Property(x => x.GroupName).HasMaxLength(Permission.GroupNameMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Permission.NameMaxLength).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
    }
}
