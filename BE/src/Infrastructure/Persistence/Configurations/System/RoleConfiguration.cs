using Domain.Entities.System.Roles;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("System_Roles");

        builder.Property(x => x.Code).HasMaxLength(Role.CodeMaxLength).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(Role.NameMaxLength).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(Role.DescriptionMaxLength);

        // Mã vai trò không trùng trong số vai trò chưa xóa; vai trò đã xóa mềm không giữ chỗ mã.
        builder.HasIndex(x => x.Code).IsUnique().WhereNotDeleted();

        builder.HasMany(x => x.RolePermissions)
            .WithOne(x => x.Role)
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.UserRoles)
            .WithOne(x => x.Role)
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
