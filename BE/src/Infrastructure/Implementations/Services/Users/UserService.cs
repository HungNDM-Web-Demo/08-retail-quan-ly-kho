using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Users;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Auth;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Users;
using Application.Mappings.Users;
using Domain.Entities.System.Roles;
using Domain.Entities.System.Users;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Users;

public sealed class UserService(
    IGenericRepository<User> users,
    IGenericRepository<Role> roles,
    IGenericRepository<UserRefreshToken> refreshTokens,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    ICurrentUserService currentUser,
    TimeProvider timeProvider) : IUserService
{
    private const string NotFoundMessage = "Không tìm thấy tài khoản.";

    public async Task<PaginatedResult<UserDto>> GetPagedAsync(UserQuery query, CancellationToken ct = default)
    {
        var source = users.QueryNoTracking()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .AsSplitQuery();

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(u =>
                AppDbFunctions.Matches(u.Username, pattern)
                || AppDbFunctions.Matches(u.FullName, pattern)
                || AppDbFunctions.Matches(u.Email, pattern)
                || AppDbFunctions.Matches(u.Phone, pattern));
        }

        if (query.RoleId is { } roleId)
            source = source.Where(u => u.UserRoles.Any(ur => ur.RoleId == roleId));

        if (query.IsActive is { } isActive)
            source = source.Where(u => u.IsActive == isActive);

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(u => u.ToDto()).ToList());
    }

    public async Task<UserDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var user = await users.QueryNoTracking()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException(NotFoundMessage);

        return user.ToDto();
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        var username = User.NormalizeUsername(request.Username);
        if (await users.AnyAsync(u => u.Username == username, ct))
            throw new ConflictException($"Tên đăng nhập {username} đã tồn tại.", "username");

        var roleIds = await EnsureRolesExistAsync(request.RoleIds, ct);
        var user = User.Create(username, request.FullName, request.Email, request.Phone, passwordHasher.Hash(request.Password));
        user.SetRoles(roleIds);

        await users.AddAsync(user, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(user.Id, ct);
    }

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var user = await LoadForUpdateAsync(id, ct);
        var roleIds = await EnsureRolesExistAsync(request.RoleIds, ct);

        user.UpdateProfile(request.FullName, request.Email, request.Phone);
        user.SetRoles(roleIds);

        await unitOfWork.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await LoadForUpdateAsync(id, ct);
        user.EnsureCanBeDeleted(currentUser.UserId);

        await RevokeSessionsAsync(id, ct);
        users.Delete(user);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task SetActiveAsync(Guid id, LockUserRequest request, CancellationToken ct = default)
    {
        var user = await LoadForUpdateAsync(id, ct);
        user.SetActive(request.IsActive, currentUser.UserId);

        if (!request.IsActive)
            await RevokeSessionsAsync(id, ct);

        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task ResetPasswordAsync(Guid id, ResetPasswordRequest request, CancellationToken ct = default)
    {
        var user = await LoadForUpdateAsync(id, ct);
        user.ChangePassword(passwordHasher.Hash(request.NewPassword));

        await RevokeSessionsAsync(id, ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    /// <summary>Tải tài khoản có theo dõi thay đổi, kèm vai trò để gán lại và ghi nhật ký đủ danh sách trước/sau.</summary>
    private async Task<User> LoadForUpdateAsync(Guid id, CancellationToken ct) =>
        await users.Query()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == id, ct)
        ?? throw new NotFoundException(NotFoundMessage);

    private async Task<List<Guid>> EnsureRolesExistAsync(IReadOnlyList<Guid> roleIds, CancellationToken ct)
    {
        var requested = roleIds.Distinct().ToList();

        // Tải entity (có theo dõi) để nhật ký ghi được mã vai trò thay vì Id.
        var existing = await roles.Query()
            .Where(r => requested.Contains(r.Id))
            .ToListAsync(ct);

        if (existing.Count != requested.Count)
            throw new ValidationException([new ValidationFailure(nameof(CreateUserRequest.RoleIds), "Vai trò không tồn tại.")]);

        return requested;
    }

    private async Task RevokeSessionsAsync(Guid userId, CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var sessions = await refreshTokens.Query()
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var session in sessions)
            session.Revoke(now);
    }
}
