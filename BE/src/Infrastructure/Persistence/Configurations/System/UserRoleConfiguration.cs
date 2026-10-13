using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("System_UserRoles");

        builder.HasKey(x => new { x.UserId, x.RoleId });
        builder.HasIndex(x => x.RoleId);

        // Ẩn cùng tài khoản, vai trò đã xóa mềm, nên số tài khoản của vai trò chỉ đếm tài khoản còn dùng.
        builder.HasQueryFilter(x => !x.User.IsDeleted && !x.Role.IsDeleted);
    }
}
