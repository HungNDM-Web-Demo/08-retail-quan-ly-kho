using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Roles;
using Application.Interfaces.Services.Roles;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Roles;

/// <summary>Danh mục quyền (chỉ đọc, tạo bằng seed).</summary>
[Route("api/permissions")]
public sealed class PermissionsController(IPermissionService permissionService) : BaseApiController
{
    /// <summary>Danh mục quyền theo nhóm, dùng cho ma trận phân quyền.</summary>
    [HttpGet]
    [AuthorizePermission(Permissions.Roles.View)]
    [ProducesResponseType<IReadOnlyList<PermissionGroup>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PermissionGroup>>> GetGroups(CancellationToken ct) =>
        Ok(await permissionService.GetGroupsAsync(ct));
}
