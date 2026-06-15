using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationAuditing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OrderItemSchedules_OrderItemId",
                table: "OrderItemSchedules");

            migrationBuilder.CreateTable(
                name: "NotificationLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    RecipientPhone = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MessageBody = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsSuccess = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderItemSchedules_OrderItemId",
                table: "OrderItemSchedules",
                column: "OrderItemId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationLogs");

            migrationBuilder.DropIndex(
                name: "IX_OrderItemSchedules_OrderItemId",
                table: "OrderItemSchedules");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItemSchedules_OrderItemId",
                table: "OrderItemSchedules",
                column: "OrderItemId");
        }
    }
}
