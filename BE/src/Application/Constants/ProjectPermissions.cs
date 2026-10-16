namespace Application.Constants;

/// <summary>
/// Mã quyền nghiệp vụ Quản lý Kho (02-SRS §7, 07-DANH-SACH-API §1). Tách khỏi <see cref="Permissions"/> (quyền nền)
/// để không sửa file nền. Mỗi mã phải có trong FE/src/mock/seed/project.json và FE src/config/permissions.ts;
/// test <c>ProjectPermissionTests</c> kiểm tra việc này.
/// </summary>
public static class ProjectPermissions
{
    public static class Products
    {
        public const string View = "products.view";
        public const string Create = "products.create";
        public const string Update = "products.update";
        public const string Delete = "products.delete";
    }

    public static class Warehouses
    {
        public const string View = "warehouses.view";
        public const string Create = "warehouses.create";
        public const string Update = "warehouses.update";
        public const string Delete = "warehouses.delete";

        /// <summary>Gán kho cho thủ kho; người có quyền này thấy mọi kho (BR-23, quyết định 1).</summary>
        public const string Assign = "warehouses.assign";
    }

    public static class Suppliers
    {
        public const string View = "suppliers.view";
        public const string Create = "suppliers.create";
        public const string Update = "suppliers.update";
        public const string Delete = "suppliers.delete";
    }

    public static class GoodsReceipts
    {
        public const string View = "goods-receipts.view";
        public const string Create = "goods-receipts.create";
        public const string Update = "goods-receipts.update";
        public const string Delete = "goods-receipts.delete";
        public const string Approve = "goods-receipts.approve";
        public const string Reverse = "goods-receipts.reverse";
    }

    public static class GoodsIssues
    {
        public const string View = "goods-issues.view";
        public const string Create = "goods-issues.create";
        public const string Update = "goods-issues.update";
        public const string Delete = "goods-issues.delete";
        public const string Approve = "goods-issues.approve";
        public const string Reverse = "goods-issues.reverse";
    }

    public static class Transfers
    {
        public const string View = "transfers.view";
        public const string Create = "transfers.create";
        public const string Update = "transfers.update";
        public const string Delete = "transfers.delete";
        public const string Approve = "transfers.approve";
        public const string Receive = "transfers.receive";
    }

    public static class StockLevels
    {
        public const string View = "stock-levels.view";
    }

    public static class StockValues
    {
        /// <summary>Xem giá vốn, giá trị tồn, giá trị xuất (BR-25).</summary>
        public const string View = "stock-values.view";
    }

    public static class Stocktakes
    {
        public const string View = "stocktakes.view";
        public const string Create = "stocktakes.create";
        public const string Count = "stocktakes.count";
        public const string Approve = "stocktakes.approve";
        public const string Cancel = "stocktakes.cancel";
    }

    public static class Reports
    {
        public const string View = "reports.view";
    }
}
