using API.Filters;
using Application.Common.Models;
using Application.Interfaces.Services.Common;
using Microsoft.AspNetCore.Mvc;

namespace API.Base;

/// <summary>
/// Controller CRUD dựng sẵn: GET danh sách, GET chi tiết, POST, PUT, DELETE, kiểm tra quyền theo <see cref="CrudPermissions"/>.
/// Controller con chỉ khai báo route, service và tên resource; <typeparamref name="TQuery"/> là bộ lọc riêng của danh sách.
/// </summary>
public abstract class CrudApiController<TService, TDto, TCreate, TUpdate, TQuery>(TService service, CrudPermissions permissions)
    : BaseApiController, ICrudPermissionProvider
    where TService : ICrudService<TDto, TCreate, TUpdate, TQuery>
    where TDto : IHasGuidId
    where TQuery : PaginationQuery
{
    protected TService Service { get; } = service;

    public CrudPermissions CrudPermissions { get; } = permissions;

    /// <summary>Danh sách có phân trang, tìm kiếm (<c>search</c>), sắp xếp (<c>sortBy</c>, <c>sortDir</c>).</summary>
    [HttpGet]
    [RequireCrudPermission(CrudOperation.View)]
    public virtual async Task<ActionResult<PaginatedResult<TDto>>> GetAll([FromQuery] TQuery query, CancellationToken ct) =>
        Ok(await Service.GetPagedAsync(query, ct));

    /// <summary>Chi tiết theo Id.</summary>
    [HttpGet("{id:guid}")]
    [RequireCrudPermission(CrudOperation.View)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public virtual async Task<ActionResult<TDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await Service.GetByIdAsync(id, ct));

    /// <summary>Tạo mới, trả 201 kèm header Location.</summary>
    [HttpPost]
    [RequireCrudPermission(CrudOperation.Create)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public virtual async Task<ActionResult<TDto>> Create(TCreate request, CancellationToken ct)
    {
        var item = await Service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, item);
    }

    /// <summary>Sửa toàn bộ.</summary>
    [HttpPut("{id:guid}")]
    [RequireCrudPermission(CrudOperation.Update)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public virtual async Task<ActionResult<TDto>> Update(Guid id, TUpdate request, CancellationToken ct) =>
        Ok(await Service.UpdateAsync(id, request, ct));

    /// <summary>Xóa, trả 204.</summary>
    [HttpDelete("{id:guid}")]
    [RequireCrudPermission(CrudOperation.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public virtual async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Controller CRUD dựng sẵn, danh sách chỉ dùng query chung (page, pageSize, search, sortBy, sortDir).</summary>
public abstract class CrudApiController<TService, TDto, TCreate, TUpdate>(TService service, CrudPermissions permissions)
    : CrudApiController<TService, TDto, TCreate, TUpdate, PaginationQuery>(service, permissions)
    where TService : ICrudService<TDto, TCreate, TUpdate>
    where TDto : IHasGuidId
{
}
