using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Base;

/// <summary>
/// Controller gốc. Luồng chuẩn: Controller → IService → IGenericRepository / IUnitOfWork.
/// Controller chỉ nhận request, gọi service, trả DTO; không inject DbContext hay repository, không viết nghiệp vụ.
/// Mọi endpoint mặc định yêu cầu đăng nhập; endpoint công khai đánh dấu <c>[AllowAnonymous]</c>.
/// </summary>
[ApiController]
[Authorize]
public abstract class BaseApiController : ControllerBase
{
}
