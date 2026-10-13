using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial_System : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,");

            migrationBuilder.CreateTable(
                name: "System_AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EntityName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    OldValues = table.Column<string>(type: "text", nullable: true),
                    NewValues = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "System_Permissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    GroupName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_Permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "System_Roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "System_Settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Value = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    GroupName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_Settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "System_Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    FullName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AvatarUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDemoAccount = table.Column<bool>(type: "boolean", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailedLoginCount = table.Column<int>(type: "integer", nullable: false),
                    LockoutEndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "System_RolePermissions",
                columns: table => new
                {
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissionId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_RolePermissions", x => new { x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_System_RolePermissions_System_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "System_Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_System_RolePermissions_System_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "System_Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "System_UserRefreshTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_UserRefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_System_UserRefreshTokens_System_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "System_UserRoles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_System_UserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_System_UserRoles_System_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "System_Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_System_UserRoles_System_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_System_AuditLogs_CreatedAt",
                table: "System_AuditLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_System_AuditLogs_EntityName_EntityId",
                table: "System_AuditLogs",
                columns: new[] { "EntityName", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_System_AuditLogs_UserId",
                table: "System_AuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_System_Permissions_Code",
                table: "System_Permissions",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_System_RolePermissions_PermissionId",
                table: "System_RolePermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_System_Roles_Code",
                table: "System_Roles",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_System_Settings_Key",
                table: "System_Settings",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_System_UserRefreshTokens_TokenHash",
                table: "System_UserRefreshTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_System_UserRefreshTokens_UserId",
                table: "System_UserRefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_System_UserRoles_RoleId",
                table: "System_UserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_System_Users_Username",
                table: "System_Users",
                column: "Username",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "System_AuditLogs");

            migrationBuilder.DropTable(
                name: "System_RolePermissions");

            migrationBuilder.DropTable(
                name: "System_Settings");

            migrationBuilder.DropTable(
                name: "System_UserRefreshTokens");

            migrationBuilder.DropTable(
                name: "System_UserRoles");

            migrationBuilder.DropTable(
                name: "System_Permissions");

            migrationBuilder.DropTable(
                name: "System_Roles");

            migrationBuilder.DropTable(
                name: "System_Users");
        }
    }
}
