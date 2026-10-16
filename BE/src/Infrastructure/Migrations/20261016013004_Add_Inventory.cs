using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Inventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Inventory_ProductGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_ProductGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_Suppliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TaxCode = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Address = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    ContactName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_Warehouses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_Warehouses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_Products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SearchText = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaseUnit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Barcode = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    Spec = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_Products_Inventory_ProductGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Inventory_ProductGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_Stocktakes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScopeAll = table.Column<bool>(type: "boolean", nullable: false),
                    ScopeGroupIds = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SnapshotAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CounterId = table.Column<Guid>(type: "uuid", nullable: false),
                    CounterName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SubmittedById = table.Column<Guid>(type: "uuid", nullable: true),
                    SubmittedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ReturnNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SurplusValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ShortageValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    LastRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_Stocktakes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_Stocktakes_Inventory_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_Stocktakes_System_Users_CounterId",
                        column: x => x.CounterId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_Transfers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FromWarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToWarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReceivedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ReceivedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TotalValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ShortageValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedById = table.Column<Guid>(type: "uuid", nullable: true),
                    RejectedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    RejectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    LastRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_Transfers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_Transfers_Inventory_Warehouses_FromWarehouseId",
                        column: x => x.FromWarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_Transfers_Inventory_Warehouses_ToWarehouseId",
                        column: x => x.ToWarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_WarehouseKeepers",
                columns: table => new
                {
                    WarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_WarehouseKeepers", x => new { x.WarehouseId, x.UserId });
                    table.ForeignKey(
                        name: "FK_Inventory_WarehouseKeepers_Inventory_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Inventory_WarehouseKeepers_System_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_ProductUnits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Factor = table.Column<int>(type: "integer", nullable: false),
                    Barcode = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_ProductUnits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_ProductUnits_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_StockLedger",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    PostedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Seq = table.Column<long>(type: "bigint", nullable: false),
                    DocType = table.Column<int>(type: "integer", nullable: false),
                    DocId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DocLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubType = table.Column<int>(type: "integer", nullable: true),
                    CounterpartWarehouseId = table.Column<Guid>(type: "uuid", nullable: true),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    InQuantity = table.Column<int>(type: "integer", nullable: false),
                    OutQuantity = table.Column<int>(type: "integer", nullable: false),
                    BalanceQuantity = table.Column<int>(type: "integer", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OutValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BalanceValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AvgCostAfter = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_StockLedger", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_StockLedger_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_StockLedger_Inventory_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_StockLevels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    OnHand = table.Column<int>(type: "integer", nullable: false),
                    StockValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AvgCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinQty = table.Column<int>(type: "integer", nullable: true),
                    MaxQty = table.Column<int>(type: "integer", nullable: true),
                    LastIssueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FirstReceiptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_StockLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_StockLevels_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_StockLevels_Inventory_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_StocktakeCounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StocktakeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Entries = table.Column<string>(type: "text", nullable: false),
                    CountedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CountedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_StocktakeCounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_StocktakeCounts_Inventory_Stocktakes_StocktakeId",
                        column: x => x.StocktakeId,
                        principalTable: "Inventory_Stocktakes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_StocktakeLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StocktakeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BaseUnit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BookQuantity = table.Column<int>(type: "integer", nullable: false),
                    BookCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CountedQuantity = table.Column<int>(type: "integer", nullable: true),
                    Difference = table.Column<int>(type: "integer", nullable: true),
                    DifferenceValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ReasonRequired = table.Column<bool>(type: "boolean", nullable: false),
                    Reason = table.Column<int>(type: "integer", nullable: true),
                    ReasonNote = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    NeedsRecount = table.Column<bool>(type: "boolean", nullable: false),
                    RecountNote = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsAdded = table.Column<bool>(type: "boolean", nullable: false),
                    LastCountedById = table.Column<Guid>(type: "uuid", nullable: true),
                    LastCountedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    LastCountedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_StocktakeLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_StocktakeLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_StocktakeLines_Inventory_Stocktakes_StocktakeId",
                        column: x => x.StocktakeId,
                        principalTable: "Inventory_Stocktakes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_TransferLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TransferId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ReceivedBaseQuantity = table.Column<int>(type: "integer", nullable: true),
                    ShortageQuantity = table.Column<int>(type: "integer", nullable: true),
                    ShortageValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LineNo = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BaseUnit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitName = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Factor = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    BaseQuantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_TransferLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_TransferLines_Inventory_ProductUnits_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Inventory_ProductUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_TransferLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_TransferLines_Inventory_Transfers_TransferId",
                        column: x => x.TransferId,
                        principalTable: "Inventory_Transfers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_GoodsIssueLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IssueId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LineNo = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BaseUnit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitName = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Factor = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    BaseQuantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_GoodsIssueLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsIssueLines_Inventory_ProductUnits_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Inventory_ProductUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsIssueLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_GoodsIssues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    RecipientName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrderRef = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    TotalValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReversalOfReceiptId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedById = table.Column<Guid>(type: "uuid", nullable: true),
                    RejectedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    RejectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    LastRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_GoodsIssues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsIssues_Inventory_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Inventory_Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsIssues_Inventory_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_GoodsReceipts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WarehouseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    DelivererName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    SourceDocNo = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    SourceDocDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FreightCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReversalOfIssueId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedById = table.Column<Guid>(type: "uuid", nullable: true),
                    RejectedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    RejectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    LastRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_GoodsReceipts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceipts_Inventory_GoodsIssues_ReversalOfIss~",
                        column: x => x.ReversalOfIssueId,
                        principalTable: "Inventory_GoodsIssues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceipts_Inventory_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Inventory_Suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceipts_Inventory_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Inventory_Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Inventory_GoodsReceiptLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReceiptId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AllocatedCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LineNo = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BaseUnit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitName = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Factor = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    BaseQuantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory_GoodsReceiptLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceiptLines_Inventory_GoodsReceipts_Receipt~",
                        column: x => x.ReceiptId,
                        principalTable: "Inventory_GoodsReceipts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceiptLines_Inventory_ProductUnits_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Inventory_ProductUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Inventory_GoodsReceiptLines_Inventory_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Inventory_Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssueLines_IssueId_LineNo",
                table: "Inventory_GoodsIssueLines",
                columns: new[] { "IssueId", "LineNo" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssueLines_ProductId",
                table: "Inventory_GoodsIssueLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssueLines_UnitId",
                table: "Inventory_GoodsIssueLines",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssues_ApprovedAt",
                table: "Inventory_GoodsIssues",
                column: "ApprovedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssues_ClientRequestId",
                table: "Inventory_GoodsIssues",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssues_Code",
                table: "Inventory_GoodsIssues",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssues_ReversalOfReceiptId",
                table: "Inventory_GoodsIssues",
                column: "ReversalOfReceiptId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssues_Status_SubmittedAt",
                table: "Inventory_GoodsIssues",
                columns: new[] { "Status", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssues_SupplierId",
                table: "Inventory_GoodsIssues",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsIssues_WarehouseId_Status",
                table: "Inventory_GoodsIssues",
                columns: new[] { "WarehouseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceiptLines_ProductId",
                table: "Inventory_GoodsReceiptLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceiptLines_ReceiptId_LineNo",
                table: "Inventory_GoodsReceiptLines",
                columns: new[] { "ReceiptId", "LineNo" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceiptLines_UnitId",
                table: "Inventory_GoodsReceiptLines",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_ApprovedAt",
                table: "Inventory_GoodsReceipts",
                column: "ApprovedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_ClientRequestId",
                table: "Inventory_GoodsReceipts",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_Code",
                table: "Inventory_GoodsReceipts",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_ReversalOfIssueId",
                table: "Inventory_GoodsReceipts",
                column: "ReversalOfIssueId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_Status_SubmittedAt",
                table: "Inventory_GoodsReceipts",
                columns: new[] { "Status", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_SupplierId",
                table: "Inventory_GoodsReceipts",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_GoodsReceipts_WarehouseId_Status",
                table: "Inventory_GoodsReceipts",
                columns: new[] { "WarehouseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_ProductGroups_Code",
                table: "Inventory_ProductGroups",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Products_Barcode",
                table: "Inventory_Products",
                column: "Barcode",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Products_Code",
                table: "Inventory_Products",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Products_GroupId",
                table: "Inventory_Products",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_ProductUnits_Barcode",
                table: "Inventory_ProductUnits",
                column: "Barcode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_ProductUnits_ProductId_SortOrder",
                table: "Inventory_ProductUnits",
                columns: new[] { "ProductId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockLedger_DocId",
                table: "Inventory_StockLedger",
                column: "DocId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockLedger_PostedAt",
                table: "Inventory_StockLedger",
                column: "PostedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockLedger_ProductId_PostedAt",
                table: "Inventory_StockLedger",
                columns: new[] { "ProductId", "PostedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockLedger_WarehouseId_ProductId_PostedAt",
                table: "Inventory_StockLedger",
                columns: new[] { "WarehouseId", "ProductId", "PostedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockLevels_ProductId",
                table: "Inventory_StockLevels",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StockLevels_WarehouseId_ProductId",
                table: "Inventory_StockLevels",
                columns: new[] { "WarehouseId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StocktakeCounts_StocktakeId_ClientRequestId",
                table: "Inventory_StocktakeCounts",
                columns: new[] { "StocktakeId", "ClientRequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StocktakeLines_ProductId",
                table: "Inventory_StocktakeLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_StocktakeLines_StocktakeId_ProductId",
                table: "Inventory_StocktakeLines",
                columns: new[] { "StocktakeId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Stocktakes_ClientRequestId",
                table: "Inventory_Stocktakes",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Stocktakes_Code",
                table: "Inventory_Stocktakes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Stocktakes_CounterId",
                table: "Inventory_Stocktakes",
                column: "CounterId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Stocktakes_WarehouseId_Status",
                table: "Inventory_Stocktakes",
                columns: new[] { "WarehouseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Suppliers_Code",
                table: "Inventory_Suppliers",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_TransferLines_ProductId",
                table: "Inventory_TransferLines",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_TransferLines_TransferId_LineNo",
                table: "Inventory_TransferLines",
                columns: new[] { "TransferId", "LineNo" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_TransferLines_UnitId",
                table: "Inventory_TransferLines",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Transfers_ApprovedAt",
                table: "Inventory_Transfers",
                column: "ApprovedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Transfers_ClientRequestId",
                table: "Inventory_Transfers",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Transfers_Code",
                table: "Inventory_Transfers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Transfers_FromWarehouseId_Status",
                table: "Inventory_Transfers",
                columns: new[] { "FromWarehouseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Transfers_Status_ApprovedAt",
                table: "Inventory_Transfers",
                columns: new[] { "Status", "ApprovedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Transfers_ToWarehouseId_Status",
                table: "Inventory_Transfers",
                columns: new[] { "ToWarehouseId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_WarehouseKeepers_UserId",
                table: "Inventory_WarehouseKeepers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Warehouses_Code",
                table: "Inventory_Warehouses",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.AddForeignKey(
                name: "FK_Inventory_GoodsIssueLines_Inventory_GoodsIssues_IssueId",
                table: "Inventory_GoodsIssueLines",
                column: "IssueId",
                principalTable: "Inventory_GoodsIssues",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Inventory_GoodsIssues_Inventory_GoodsReceipts_ReversalOfRec~",
                table: "Inventory_GoodsIssues",
                column: "ReversalOfReceiptId",
                principalTable: "Inventory_GoodsReceipts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Inventory_GoodsReceipts_Inventory_GoodsIssues_ReversalOfIss~",
                table: "Inventory_GoodsReceipts");

            migrationBuilder.DropTable(
                name: "Inventory_GoodsIssueLines");

            migrationBuilder.DropTable(
                name: "Inventory_GoodsReceiptLines");

            migrationBuilder.DropTable(
                name: "Inventory_StockLedger");

            migrationBuilder.DropTable(
                name: "Inventory_StockLevels");

            migrationBuilder.DropTable(
                name: "Inventory_StocktakeCounts");

            migrationBuilder.DropTable(
                name: "Inventory_StocktakeLines");

            migrationBuilder.DropTable(
                name: "Inventory_TransferLines");

            migrationBuilder.DropTable(
                name: "Inventory_WarehouseKeepers");

            migrationBuilder.DropTable(
                name: "Inventory_Stocktakes");

            migrationBuilder.DropTable(
                name: "Inventory_ProductUnits");

            migrationBuilder.DropTable(
                name: "Inventory_Transfers");

            migrationBuilder.DropTable(
                name: "Inventory_Products");

            migrationBuilder.DropTable(
                name: "Inventory_ProductGroups");

            migrationBuilder.DropTable(
                name: "Inventory_GoodsIssues");

            migrationBuilder.DropTable(
                name: "Inventory_GoodsReceipts");

            migrationBuilder.DropTable(
                name: "Inventory_Suppliers");

            migrationBuilder.DropTable(
                name: "Inventory_Warehouses");
        }
    }
}
