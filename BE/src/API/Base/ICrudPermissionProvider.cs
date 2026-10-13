namespace API.Base;

/// <summary>Controller khai báo mã quyền CRUD, để <c>RequireCrudPermissionAttribute</c> đọc khi kiểm tra quyền.</summary>
public interface ICrudPermissionProvider
{
    // Đặt tên CrudPermissions (không phải Permissions) để controller con vẫn viết được Permissions.Xxx.Yyy
    // trỏ tới hằng số Application.Constants.Permissions.
    CrudPermissions CrudPermissions { get; }
}
