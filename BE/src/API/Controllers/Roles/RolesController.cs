using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Roles;
using Application.Interfaces.Services.Roles;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Roles;

/// <summary>Vai trò và phân quyền (UC-SYS-06).</summary>
[Route("api/roles")]
public sealed class RolesController(IRoleService roleService) : BaseApiController
{
    /// <summary>Danh sách vai trò (mảng, không phân trang) kèm số tài khoản và mã quyền.</summary>
    /// <remarks>Màn hình tài khoản cũng cần danh sách này để chọn vai trò, nên chỉ cần một trong hai quyền.</remarks>
    [HttpGet]
    [AuthorizePermission(Permissions.Roles.View, Permissions.Users.View)]
    [ProducesResponseType<IReadOnlyList<RoleDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> GetAll(CancellationToken ct) =>
        Ok(await roleService.GetAllAsync(ct));

    /// <summary>Chi tiết vai trò kèm danh sách mã quyền.</summary>
    [HttpGet("{id:guid}")]
    [AuthorizePermission(Permissions.Roles.View)]
    [ProducesResponseType<RoleDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoleDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await roleService.GetByIdAsync(id, ct));

    /// <summary>Tạo vai trò kèm quyền, trả 201.</summary>
    [HttpPost]
    [AuthorizePermission(Permissions.Roles.Create)]
    [ProducesResponseType<RoleDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RoleDto>> Create(CreateRoleRequest request, CancellationToken ct)
    {
        var role = await roleService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = role.Id }, role);
    }

    /// <summary>Sửa tên, mô tả.</summary>
    [HttpPut("{id:guid}")]
    [AuthorizePermission(Permissions.Roles.Update)]
    [ProducesResponseType<RoleDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoleDto>> Update(Guid id, UpdateRoleRequest request, CancellationToken ct) =>
        Ok(await roleService.UpdateAsync(id, request, ct));

    /// <summary>Thay toàn bộ quyền của vai trò.</summary>
    /// <remarks>Vai trò ADMIN luôn có toàn bộ quyền nên không sửa được (BR-SYS-06).</remarks>
    [HttpPut("{id:guid}/permissions")]
    [AuthorizePermission(Permissions.Roles.Update)]
    [ProducesResponseType<RoleDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoleDto>> UpdatePermissions(Guid id, UpdateRolePermissionsRequest request, CancellationToken ct) =>
        Ok(await roleService.UpdatePermissionsAsync(id, request, ct));

    /// <summary>Xóa vai trò (xóa mềm).</summary>
    /// <remarks>Không xóa được vai trò hệ thống hoặc vai trò đang gán cho tài khoản (BR-SYS-06, BR-SYS-07).</remarks>
    [HttpDelete("{id:guid}")]
    [AuthorizePermission(Permissions.Roles.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await roleService.DeleteAsync(id, ct);
        return NoContent();
    }
}
