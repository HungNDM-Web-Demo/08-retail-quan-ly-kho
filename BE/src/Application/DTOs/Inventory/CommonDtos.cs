namespace Application.DTOs.Inventory;

// Kiểu dùng chung của API kho (07 §2), khớp FE src/types/inventory.ts.

/// <summary>Mọi thao tác ghi trên một phiếu có sẵn (07 §3.8): chống ghi đè và chống bấm lặp.</summary>
public class DocActionRequest
{
    public int Version { get; set; }
    public string ClientRequestId { get; set; } = string.Empty;
}

/// <summary>Từ chối: lý do ≥ 10 ký tự (BR-06).</summary>
public sealed class RejectRequest : DocActionRequest
{
    public string? Reason { get; set; }
}

/// <summary>Dòng gửi lên khi tạo, sửa phiếu nhập, xuất, chuyển.</summary>
public class DocLineInput
{
    public Guid ProductId { get; set; }
    public Guid? UnitId { get; set; }
    public int Quantity { get; set; }
}

public sealed class SetActiveRequest
{
    public bool IsActive { get; set; }
}

public sealed record WarehouseOption(Guid Id, string Code, string Name, bool IsActive);

public sealed record UserRef(Guid Id, string Username, string FullName);

public sealed record ProductUnitDto(Guid Id, string Name, int Factor, string? Barcode, int SortOrder, bool IsUsed);

public sealed record UnitReading(string Name, int Factor);

public sealed record CatalogUnit(Guid Id, string Name, int Factor, string? Barcode);

/// <summary>Số liệu cho người duyệt (UC-05 bước 2), chỉ khi phiếu Chờ duyệt.</summary>
public sealed record ApprovalPreview(int OnHand, int Shortage, decimal? AvgCost, decimal? EstimatedValue);
