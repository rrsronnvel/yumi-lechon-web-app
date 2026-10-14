using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTwoHopQrCustodyChain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HeldByStaffMethod",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OwnerApprovedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerApprovedBy",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RiderRemittedAmount",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RiderSignedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RiderSignedBy",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SettlementCustodyStatus",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "StaffValidatedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StaffValidatedBy",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SettlementQrSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Token = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    HopStage = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExpectedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ReferenceNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RiderSignedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RiderRemittedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    RiderSignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StaffValidatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StaffValidatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OwnerApprovedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OwnerApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsUsed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SettlementQrSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SettlementQrSessions_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SettlementQrSessions_OrderId",
                table: "SettlementQrSessions",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_SettlementQrSessions_Token",
                table: "SettlementQrSessions",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SettlementQrSessions");

            migrationBuilder.DropColumn(
                name: "HeldByStaffMethod",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OwnerApprovedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OwnerApprovedBy",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RiderRemittedAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RiderSignedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RiderSignedBy",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "SettlementCustodyStatus",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "StaffValidatedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "StaffValidatedBy",
                table: "Orders");
        }
    }
}
