using Domain.Entities.System.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class UserRefreshTokenConfiguration : IEntityTypeConfiguration<UserRefreshToken>
{
    public void Configure(EntityTypeBuilder<UserRefreshToken> builder)
    {
        builder.ToTable("System_UserRefreshTokens");

        builder.Property(x => x.TokenHash).HasMaxLength(UserRefreshToken.TokenHashMaxLength).IsRequired();
        builder.HasIndex(x => x.TokenHash).IsUnique();
        builder.HasIndex(x => x.UserId);

        // Token dùng một lần: hai request gia hạn cùng lúc thì request sau gặp lỗi tranh chấp và bị từ chối.
        builder.Property(x => x.RevokedAt).IsConcurrencyToken();

        builder.HasQueryFilter(x => !x.User.IsDeleted);
    }
}
