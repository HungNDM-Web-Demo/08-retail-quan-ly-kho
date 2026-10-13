using API.Base;
using API.Filters;
using Application.Constants;
using Application.DTOs.Uploads;
using Application.Interfaces.Services.Uploads;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Uploads;

/// <summary>Tải file lên.</summary>
[Route("api/uploads")]
public sealed class UploadsController(IUploadService uploadService) : BaseApiController
{
    /// <summary>Tải ảnh (logo…): JPG, PNG, WebP, SVG, tối đa 2 MB.</summary>
    /// <remarks>
    /// Gửi multipart với trường <c>file</c>. Định dạng nhận diện theo nội dung file. Trả đường dẫn tương đối
    /// <c>/uploads/...</c>, FE ghép với địa chỉ API.
    /// </remarks>
    [HttpPost("images")]
    [AuthorizePermission(Permissions.Settings.Update)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadLimits.MaxImageRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadLimits.MaxImageRequestBytes)]
    [ProducesResponseType<UploadedImage>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UploadedImage>> UploadImage(IFormFile? file, CancellationToken ct)
    {
        await using var content = file?.OpenReadStream() ?? Stream.Null;
        var image = await uploadService.UploadImageAsync(content, file?.Length ?? 0, ct);
        return Created(image.Url, image);
    }
}
