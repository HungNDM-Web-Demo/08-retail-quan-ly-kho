using Domain.Entities.System.Users;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("System_Users");

        builder.Property(x => x.Username).HasMaxLength(User.UsernameMaxLength).IsRequired();
        builder.Property(x => x.PasswordHash).HasMaxLength(User.PasswordHashMaxLength).IsRequired();
        builder.Property(x => x.FullName).HasMaxLength(User.FullNameMaxLength).IsRequired();
        builder.Property(x => x.Email).HasMaxLength(User.EmailMaxLength);
        builder.Property(x => x.Phone).HasMaxLength(User.PhoneMaxLength);
        builder.Property(x => x.AvatarUrl).HasMaxLength(User.AvatarUrlMaxLength);

        // Tên đăng nhập không trùng trong số tài khoản chưa xóa; tài khoản đã xóa mềm không giữ chỗ tên.
        builder.HasIndex(x => x.Username).IsUnique().WhereNotDeleted();

        builder.HasMany(x => x.UserRoles)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.RefreshTokens)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
