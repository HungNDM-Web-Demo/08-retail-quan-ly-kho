namespace API.Base;

/// <summary>
/// Mã quyền cho 4 thao tác CRUD. <c>new CrudPermissions("orders")</c> sinh
/// <c>orders.view</c>, <c>orders.create</c>, <c>orders.update</c>, <c>orders.delete</c>.
/// Cần mã khác thì ghi đè bằng init, vd <c>new CrudPermissions("orders") { Delete = Permissions.Orders.Cancel }</c>.
/// </summary>
public sealed class CrudPermissions
{
    public CrudPermissions(string resource)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(resource);

        View = $"{resource}.view";
        Create = $"{resource}.create";
        Update = $"{resource}.update";
        Delete = $"{resource}.delete";
    }

    public string View { get; init; }
    public string Create { get; init; }
    public string Update { get; init; }
    public string Delete { get; init; }

    public string Get(CrudOperation operation) => operation switch
    {
        CrudOperation.View => View,
        CrudOperation.Create => Create,
        CrudOperation.Update => Update,
        CrudOperation.Delete => Delete,
        _ => throw new ArgumentOutOfRangeException(nameof(operation), operation, null)
    };
}
