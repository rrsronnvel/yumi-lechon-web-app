using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ActualPackagingTime",
                table: "OrderItemSchedules",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ActualPreppingStartTime",
                table: "OrderItemSchedules",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ActualReadyForDeliveryTime",
                table: "OrderItemSchedules",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ActualSalangTime",
                table: "OrderItemSchedules",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CurrentStatus",
                table: "OrderItemSchedules",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActualPackagingTime",
                table: "OrderItemSchedules");

            migrationBuilder.DropColumn(
                name: "ActualPreppingStartTime",
                table: "OrderItemSchedules");

            migrationBuilder.DropColumn(
                name: "ActualReadyForDeliveryTime",
                table: "OrderItemSchedules");

            migrationBuilder.DropColumn(
                name: "ActualSalangTime",
                table: "OrderItemSchedules");

            migrationBuilder.DropColumn(
                name: "CurrentStatus",
                table: "OrderItemSchedules");
        }
    }
}
