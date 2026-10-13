using Domain.Entities.System.AuditLogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.System;

public sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("System_AuditLogs");

        builder.Property(x => x.Username).HasMaxLength(AuditLog.UsernameMaxLength);
        builder.Property(x => x.Action).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(x => x.EntityName).HasMaxLength(AuditLog.EntityNameMaxLength).IsRequired();
        builder.Property(x => x.EntityId).HasMaxLength(AuditLog.EntityIdMaxLength);
        builder.Property(x => x.IpAddress).HasMaxLength(AuditLog.IpAddressMaxLength);

        // OldValues, NewValues là JSON dài: không đặt HasMaxLength, provider tự chọn kiểu không giới hạn (text / nvarchar(max)).

        // Không khóa ngoại tới System_Users: nhật ký giữ nguyên khi tài khoản bị xóa.
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => new { x.EntityName, x.EntityId });
    }
}
