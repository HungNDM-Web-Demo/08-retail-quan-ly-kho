using Domain.Entities.System.Roles;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("System_RolePermissions");

        builder.HasKey(x => new { x.RoleId, x.PermissionId });
        builder.HasIndex(x => x.PermissionId);

        builder.HasOne(x => x.Permission)
            .WithMany()
            .HasForeignKey(x => x.PermissionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Ẩn cùng vai trò đã xóa mềm.
        builder.HasQueryFilter(x => !x.Role.IsDeleted);
    }
}
