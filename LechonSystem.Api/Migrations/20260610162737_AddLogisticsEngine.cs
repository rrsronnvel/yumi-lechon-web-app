using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLogisticsEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DeliveryTripId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Fulfillment",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RoutingStatus",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "DeliveryTrips",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RiderName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    VehicleType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    DispatchTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ActualReturnTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryTrips", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_DeliveryTripId",
                table: "Orders",
                column: "DeliveryTripId");

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_DeliveryTrips_DeliveryTripId",
                table: "Orders",
                column: "DeliveryTripId",
                principalTable: "DeliveryTrips",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Orders_DeliveryTrips_DeliveryTripId",
                table: "Orders");

            migrationBuilder.DropTable(
                name: "DeliveryTrips");

            migrationBuilder.DropIndex(
                name: "IX_Orders_DeliveryTripId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DeliveryTripId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Fulfillment",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RoutingStatus",
                table: "Orders");
        }
    }
}
