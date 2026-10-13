using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Settings;
using Application.Interfaces.Services.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Settings;

/// <summary>Cài đặt chung và thương hiệu (UC-SYS-07).</summary>
[Route("api/settings")]
public sealed class SettingsController(ISettingService settingService) : BaseApiController
{
    /// <summary>Cài đặt công khai cho trang đăng nhập, trang khách: chỉ khóa nhóm <c>Brand.*</c> và <c>Company.*</c>.</summary>
    [HttpGet("public")]
    [AllowAnonymous]
    [ProducesResponseType<IReadOnlyDictionary<string, string>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyDictionary<string, string>>> GetPublic(CancellationToken ct) =>
        Ok(await settingService.GetPublicAsync(ct));

    /// <summary>Toàn bộ cài đặt, sắp theo nhóm.</summary>
    [HttpGet]
    [AuthorizePermission(Permissions.Settings.View)]
    [ProducesResponseType<IReadOnlyList<SettingItem>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SettingItem>>> GetAll(CancellationToken ct) =>
        Ok(await settingService.GetAllAsync(ct));

    /// <summary>Cập nhật nhiều khóa cài đặt một lần.</summary>
    /// <remarks>Chỉ sửa được khóa đã có; khóa không tồn tại báo lỗi tại <c>items[i].key</c>.</remarks>
    [HttpPut]
    [AuthorizePermission(Permissions.Settings.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(UpdateSettingsRequest request, CancellationToken ct)
    {
        await settingService.UpdateAsync(request, ct);
        return NoContent();
    }
}
