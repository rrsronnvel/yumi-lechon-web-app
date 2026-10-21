using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderErgonomicsAndDeliverySettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EventType",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FacebookName",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Landmark",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrderReference",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RiderDepartureTime",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SystemSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SettingKey = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SettingValue = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemSettings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "SystemSettings",
                columns: new[] { "Id", "SettingKey", "SettingValue", "UpdatedAt", "UpdatedBy" },
                values: new object[,]
                {
                    { 1, "DeliveryFeeBaseFare", "100.00", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "System" },
                    { 2, "DeliveryFeeRatePerKm", "15.00", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "System" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "EventType",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FacebookName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Landmark",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OrderReference",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RiderDepartureTime",
                table: "Orders");
        }
    }
}
