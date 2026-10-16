namespace Application.Interfaces.Repositories;

/// <summary>
/// Giao dịch ghi của nghiệp vụ kho (NFR-03): chạy thao tác trong một transaction; gặp tranh chấp phiên bản
/// (concurrency token của phiếu, dòng tồn) hoặc trùng khóa unique (mã chứng từ, <c>clientRequestId</c>) thì bỏ hết thay đổi,
/// đọc lại và chạy lại đúng một lần (06 §3, 07 §3.8). Thao tác phải tự đọc dữ liệu bên trong <c>action</c>.
/// </summary>
public interface IInventoryTransaction
{
    Task<T> RunAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct = default);

    /// <summary>Khóa dòng kho tới hết transaction (Postgres <c>SELECT … FOR UPDATE</c>; provider khác bỏ qua).</summary>
    Task LockWarehouseAsync(Guid warehouseId, CancellationToken ct = default);
}
