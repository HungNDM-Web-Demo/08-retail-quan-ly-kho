using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Interfaces.Services.Common;
using Domain.Base;
using Domain.Entities.System.AuditLogs;
using Domain.Entities.System.Permissions;
using Domain.Entities.System.Roles;
using Domain.Entities.System.Users;
using Domain.Enums.System.AuditLogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Infrastructure.Persistence.Interceptors;

/// <summary>
/// Chạy trước mỗi lần SaveChanges:
/// <list type="bullet">
/// <item>Điền <c>CreatedAt/CreatedBy</c>, <c>UpdatedAt/UpdatedBy</c> (không gán tay trong service).</item>
/// <item>Đổi xóa thành xóa mềm với entity có <see cref="ISoftDelete"/>.</item>
/// <item>Ghi <c>System_AuditLogs</c> cho Create/Update/Delete, OldValues/NewValues là JSON các cột thay đổi.
/// Thay đổi vai trò của tài khoản, quyền của vai trò được gộp vào bản ghi của tài khoản/vai trò đó (khóa <c>roles</c>,
/// <c>permissions</c>). Bỏ qua bảng AuditLog, UserRefreshToken, entity có <see cref="IAuditLogExempt"/>
/// và khi <see cref="AppDbContext.SuppressAuditLog"/> bật.</item>
/// <item>Cột bí mật (tên chứa <c>Password</c> hoặc kết thúc bằng <c>TokenHash</c>, <c>Secret</c>) ghi <c>***</c> thay cho giá trị.</item>
/// </list>
/// </summary>
public sealed class AuditSaveChangesInterceptor(ICurrentUserService currentUser, TimeProvider timeProvider)
    : SaveChangesInterceptor
{
    private const string MaskedValue = "***";

    /// <summary>Cột theo dõi, tự điền nên không ghi vào nhật ký.</summary>
    private static readonly HashSet<string> TrackingProperties =
    [
        nameof(BaseEntity.Id),
        nameof(BaseEntity.CreatedAt),
        nameof(BaseEntity.UpdatedAt),
        nameof(ICreationTracked.CreatedBy),
        nameof(IModificationTracked.UpdatedBy),
        nameof(ISoftDelete.IsDeleted)
    ];

    /// <summary>Cột cập nhật khi đăng nhập, không tính là sửa dữ liệu.</summary>
    private static readonly HashSet<string> IgnoredProperties =
    [
        nameof(User.FailedLoginCount),
        nameof(User.LockoutEndAt),
        nameof(User.LastLoginAt)
    ];

    /// <summary>Hậu tố tên cột bí mật (ngoài các cột có chữ <c>Password</c>), xem <see cref="IsMasked"/>.</summary>
    private static readonly string[] MaskedSuffixes = ["TokenHash", "Secret"];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter() }
    };

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Apply(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Apply(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Apply(DbContext? context)
    {
        if (context is null)
            return;

        context.ChangeTracker.DetectChanges();

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var actorId = currentUser.UserId;
        var writeLogs = context is not AppDbContext { SuppressAuditLog: true };
        var relationChanges = writeLogs ? CollectRelationChanges(context) : new Dictionary<Guid, RelationChange>();
        var logs = new List<AuditLog>();

        foreach (var entry in context.ChangeTracker.Entries<BaseEntity>().ToList())
        {
            var audited = writeLogs && IsAudited(entry.Entity);
            relationChanges.Remove(entry.Entity.Id, out var relation);

            switch (entry.State)
            {
                case EntityState.Added:
                {
                    StampCreated(entry, now, actorId);
                    if (audited)
                    {
                        var newValues = Snapshot(entry, useCurrentValues: true);
                        if (relation is not null)
                            newValues[relation.Key] = relation.After;
                        logs.Add(CreateLog(AuditAction.Create, entry, null, newValues));
                    }

                    break;
                }

                case EntityState.Modified:
                case EntityState.Unchanged when relation is not null:
                {
                    var changed = GetChangedProperties(entry);
                    if (changed.Count == 0 && relation is null)
                        break;

                    StampModified(entry, now, actorId);
                    if (audited)
                    {
                        var oldValues = changed.ToDictionary(p => ToJsonName(p.Metadata.Name), p => FormatValue(p, p.OriginalValue));
                        var newValues = changed.ToDictionary(p => ToJsonName(p.Metadata.Name), p => FormatValue(p, p.CurrentValue));
                        if (relation is not null)
                        {
                            oldValues[relation.Key] = relation.Before;
                            newValues[relation.Key] = relation.After;
                        }

                        logs.Add(CreateLog(AuditAction.Update, entry, oldValues, newValues));
                    }

                    break;
                }

                case EntityState.Deleted:
                {
                    var oldValues = audited ? Snapshot(entry, useCurrentValues: false) : null;
                    if (entry.Entity is ISoftDelete softDelete)
                    {
                        entry.State = EntityState.Modified;
                        softDelete.IsDeleted = true;
                        StampModified(entry, now, actorId);
                    }

                    if (audited)
                        logs.Add(CreateLog(AuditAction.Delete, entry, oldValues, null));
                    break;
                }
            }
        }

        foreach (var log in logs)
        {
            context.Add(log);
            context.Entry(log).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = now;
        }
    }

    private static bool IsAudited(BaseEntity entity) => entity is not (AuditLog or UserRefreshToken or IAuditLogExempt);

    private static void StampCreated(EntityEntry<BaseEntity> entry, DateTime now, Guid? actorId)
    {
        // Seeder dữ liệu mẫu có thể gán sẵn CreatedAt lùi ngày; khi đó giữ nguyên.
        var createdAt = entry.Property(nameof(BaseEntity.CreatedAt));
        if ((DateTime)createdAt.CurrentValue! == default)
            createdAt.CurrentValue = now;

        if (entry.Entity is ICreationTracked creation && creation.CreatedBy is null)
            creation.CreatedBy = actorId;
    }

    private static void StampModified(EntityEntry<BaseEntity> entry, DateTime now, Guid? actorId)
    {
        entry.Property(nameof(BaseEntity.UpdatedAt)).CurrentValue = now;
        if (entry.Entity is IModificationTracked modification)
            modification.UpdatedBy = actorId;
    }

    private static List<PropertyEntry> GetChangedProperties(EntityEntry entry) =>
        entry.Properties
            .Where(p => p.IsModified
                && !TrackingProperties.Contains(p.Metadata.Name)
                && !IgnoredProperties.Contains(p.Metadata.Name)
                && !Equals(p.OriginalValue, p.CurrentValue))
            .ToList();

    private static Dictionary<string, object?> Snapshot(EntityEntry entry, bool useCurrentValues) =>
        entry.Properties
            .Where(p => !TrackingProperties.Contains(p.Metadata.Name)
                && !IgnoredProperties.Contains(p.Metadata.Name))
            .ToDictionary(
                p => ToJsonName(p.Metadata.Name),
                p => FormatValue(p, useCurrentValues ? p.CurrentValue : p.OriginalValue));

    /// <summary>Giá trị ghi vào nhật ký: cột bí mật có giá trị thì thay bằng <c>***</c> (vẫn thấy là có đổi).</summary>
    private static object? FormatValue(PropertyEntry property, object? value) =>
        value is not null && IsMasked(property.Metadata.Name) ? MaskedValue : value;

    /// <summary>
    /// Cột bí mật, không ghi giá trị vào nhật ký: tên chứa <c>Password</c> (vd <c>PasswordHash</c>, <c>DemoPassword</c>)
    /// hoặc kết thúc bằng <c>TokenHash</c>, <c>Secret</c>.
    /// </summary>
    internal static bool IsMasked(string propertyName) =>
        propertyName.Contains("Password", StringComparison.OrdinalIgnoreCase)
        || MaskedSuffixes.Any(suffix => propertyName.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));

    private static string ToJsonName(string propertyName) => JsonNamingPolicy.CamelCase.ConvertName(propertyName);

    private AuditLog CreateLog(
        AuditAction action,
        EntityEntry<BaseEntity> entry,
        Dictionary<string, object?>? oldValues,
        Dictionary<string, object?>? newValues) =>
        AuditLog.Create(
            action,
            entry.Metadata.ClrType.Name,
            entry.Entity.Id.ToString(),
            currentUser.UserId,
            currentUser.Username,
            currentUser.IpAddress,
            Serialize(oldValues),
            Serialize(newValues));

    private static string? Serialize(Dictionary<string, object?>? values) =>
        values is null || values.Count == 0 ? null : JsonSerializer.Serialize(values, JsonOptions);

    /// <summary>
    /// Gom thay đổi ở bảng nối (gán vai trò cho tài khoản, gán quyền cho vai trò) theo bản ghi cha.
    /// Danh sách trước/sau lấy từ các dòng đang được theo dõi, nên service cần Include bảng nối trước khi sửa.
    /// </summary>
    private static Dictionary<Guid, RelationChange> CollectRelationChanges(DbContext context)
    {
        var result = new Dictionary<Guid, RelationChange>();

        var userRoles = context.ChangeTracker.Entries<UserRole>().ToList();
        if (userRoles.Any(e => e.State is EntityState.Added or EntityState.Deleted))
        {
            var roleCodes = context.ChangeTracker.Entries<Role>().ToDictionary(e => e.Entity.Id, e => e.Entity.Code);
            foreach (var group in userRoles.GroupBy(e => e.Entity.UserId))
            {
                if (group.Any(e => e.State is EntityState.Added or EntityState.Deleted))
                {
                    result[group.Key] = BuildRelationChange(
                        "roles", group, e => e.Entity.RoleId, id => roleCodes.GetValueOrDefault(id));
                }
            }
        }

        var rolePermissions = context.ChangeTracker.Entries<RolePermission>().ToList();
        if (rolePermissions.Any(e => e.State is EntityState.Added or EntityState.Deleted))
        {
            var permissionCodes = context.ChangeTracker
                .Entries<Permission>()
                .ToDictionary(e => e.Entity.Id, e => e.Entity.Code);
            foreach (var group in rolePermissions.GroupBy(e => e.Entity.RoleId))
            {
                if (group.Any(e => e.State is EntityState.Added or EntityState.Deleted))
                {
                    result[group.Key] = BuildRelationChange(
                        "permissions", group, e => e.Entity.PermissionId, id => permissionCodes.GetValueOrDefault(id));
                }
            }
        }

        return result;
    }

    private static RelationChange BuildRelationChange<TJoin>(
        string key,
        IEnumerable<EntityEntry<TJoin>> entries,
        Func<EntityEntry<TJoin>, Guid> getRelatedId,
        Func<Guid, string?> findCode)
        where TJoin : class
    {
        var list = entries.ToList();
        string Describe(EntityEntry<TJoin> e)
        {
            var id = getRelatedId(e);
            return findCode(id) ?? id.ToString();
        }

        var before = list.Where(e => e.State != EntityState.Added).Select(Describe).Order(StringComparer.Ordinal).ToList();
        var after = list.Where(e => e.State != EntityState.Deleted).Select(Describe).Order(StringComparer.Ordinal).ToList();
        return new RelationChange(key, before, after);
    }

    private sealed record RelationChange(string Key, List<string> Before, List<string> After);
}
