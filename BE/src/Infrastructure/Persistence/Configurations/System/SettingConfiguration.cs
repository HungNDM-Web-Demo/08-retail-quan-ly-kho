using Domain.Entities.System.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class SettingConfiguration : IEntityTypeConfiguration<Setting>
{
    public void Configure(EntityTypeBuilder<Setting> builder)
    {
        builder.ToTable("System_Settings");

        builder.Property(x => x.Key).HasMaxLength(Setting.KeyMaxLength).IsRequired();
        builder.Property(x => x.Value).HasMaxLength(Setting.ValueMaxLength).IsRequired();
        builder.Property(x => x.GroupName).HasMaxLength(Setting.GroupNameMaxLength).IsRequired();
        builder.HasIndex(x => x.Key).IsUnique();
    }
}
