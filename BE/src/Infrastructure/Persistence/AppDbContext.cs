using System.Linq.Expressions;
using Domain.Base;
using Domain.Entities.System.AuditLogs;
using Domain.Entities.System.Permissions;
using Domain.Entities.System.Roles;
using Domain.Entities.System.Settings;
using Domain.Entities.System.Users;
using Infrastructure.Extensions;
using Infrastructure.Persistence.Converters;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Query.SqlExpressions;
using Microsoft.EntityFrameworkCore.Storage;

namespace Infrastructure.Persistence;

/// <summary>
/// DbContext duy nhất của ứng dụng. Cấu hình bảng đặt ở Persistence/Configurations/{Area}/,
/// tự nạp bằng <see cref="ModelBuilder.ApplyConfigurationsFromAssembly(System.Reflection.Assembly, Func{Type, bool})"/>.
/// Service không dùng trực tiếp lớp này mà đi qua IGenericRepository / IUnitOfWork.
/// Chạy được với Postgres (mặc định), SQL Server, SQLite; phần khác nhau giữa provider gom hết ở đây.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
        // Xóa mềm cần đổi trạng thái Deleted → Modified trong interceptor trước khi EF lan truyền xóa sang bảng con.
        ChangeTracker.CascadeDeleteTiming = CascadeTiming.OnSaveChanges;
        ChangeTracker.DeleteOrphansTiming = CascadeTiming.OnSaveChanges;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<UserRefreshToken> UserRefreshTokens => Set<UserRefreshToken>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    /// <summary>
    /// true thì AuditSaveChangesInterceptor vẫn điền thời gian, người tạo/sửa nhưng không ghi System_AuditLogs.
    /// Seeder và đặt lại dữ liệu demo bật cờ này để nhật ký không bị tràn.
    /// </summary>
    public bool SuppressAuditLog { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        ApplySoftDeleteFilters(modelBuilder);
        ApplySoftDeleteIndexFilters(modelBuilder);
        ConfigureMatchesFunction(modelBuilder);

        // Tìm không dấu tiếng Việt trên Postgres; migration tạo extension (CREATE EXTENSION unaccent).
        if (Database.IsNpgsql())
            modelBuilder.HasPostgresExtension("unaccent");
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Lưu UTC, đọc ra luôn Kind = Utc để JSON có hậu tố "Z". Npgsql bắt buộc Kind = Utc với timestamptz.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();

        // SQLite không so sánh, sắp xếp được decimal; lưu dạng số thực (đủ chính xác cho tiền VNĐ của demo).
        if (Database.IsSqlite())
            configurationBuilder.Properties<decimal>().HaveConversion<double>();
    }

    /// <summary>Entity có <see cref="ISoftDelete"/> tự có filter <c>!IsDeleted</c>, trừ khi cấu hình đã tự khai báo filter.</summary>
    private static void ApplySoftDeleteFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(ISoftDelete).IsAssignableFrom(entityType.ClrType)
                || entityType.BaseType is not null
                || entityType.GetQueryFilter() is not null)
            {
                continue;
            }

            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var isDeleted = Expression.Property(parameter, nameof(ISoftDelete.IsDeleted));
            entityType.SetQueryFilter(Expression.Lambda(Expression.Not(isDeleted), parameter));
        }
    }

    /// <summary>
    /// Index đánh dấu <see cref="SoftDeleteIndexExtensions.WhereNotDeleted{T}"/> được điền filter SQL đúng provider.
    /// </summary>
    private void ApplySoftDeleteIndexFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var index in entityType.GetIndexes())
            {
                if (index.GetFilter() != SoftDeleteIndexExtensions.FilterPlaceholder)
                    continue;

                var column = entityType.FindProperty(nameof(ISoftDelete.IsDeleted))?.GetColumnName()
                    ?? nameof(ISoftDelete.IsDeleted);
                index.SetFilter(Database.IsSqlServer() ? $"[{column}] = 0"
                    : Database.IsNpgsql() ? $"\"{column}\" = false"
                    : $"\"{column}\" = 0");
            }
        }
    }

    /// <summary>
    /// Khai báo <see cref="AppDbFunctions.Matches"/>: Postgres dịch thành
    /// <c>lower(unaccent(value)) LIKE lower(unaccent(pattern)) ESCAPE '\'</c>, SQL Server và SQLite thành
    /// <c>value LIKE pattern ESCAPE '\'</c>.
    /// </summary>
    private void ConfigureMatchesFunction(ModelBuilder modelBuilder)
    {
        var isPostgres = Database.IsNpgsql();
        var typeMappingSource = this.GetService<IRelationalTypeMappingSource>();
        var boolMapping = typeMappingSource.FindMapping(typeof(bool));

        modelBuilder
            .HasDbFunction(() => AppDbFunctions.Matches(default, default!))
            .HasTranslation(args =>
            {
                var value = args[0];
                var pattern = args[1];
                var stringMapping = value.TypeMapping ?? pattern.TypeMapping ?? typeMappingSource.FindMapping(typeof(string));
                var escape = new SqlConstantExpression(Expression.Constant(LikePattern.EscapeCharacter), stringMapping);

                if (isPostgres)
                {
                    value = Call("lower", Call("unaccent", value, stringMapping), stringMapping);
                    pattern = Call("lower", Call("unaccent", pattern, stringMapping), stringMapping);
                }

                return new LikeExpression(value, pattern, escape, boolMapping);
            });
    }

    private static SqlFunctionExpression Call(string name, SqlExpression argument, RelationalTypeMapping? typeMapping) =>
        new(name, [argument], nullable: true, argumentsPropagateNullability: [true], typeof(string), typeMapping);
}
