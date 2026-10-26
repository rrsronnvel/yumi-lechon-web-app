using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsTimeTbdSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsTimeTbd",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.InsertData(
                table: "ItemCategories",
                columns: new[] { "Id", "BasePrice", "CreatedAt", "IsActive", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name", "UpdatedAt" },
                values: new object[] { 21, 300.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "Raw Innards (Lamang-Loob)", null });

            migrationBuilder.UpdateData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "FullName", "PhoneNumber" },
                values: new object[] { "Aaron", "" });

            migrationBuilder.UpdateData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "FullName", "PhoneNumber" },
                values: new object[] { "AL", "" });

            migrationBuilder.UpdateData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "FullName", "PhoneNumber" },
                values: new object[] { "Francis", "" });

            migrationBuilder.InsertData(
                table: "Riders",
                columns: new[] { "Id", "CreatedAt", "FullName", "IsActive", "PhoneNumber" },
                values: new object[,]
                {
                    { 4, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Joener", true, "" },
                    { 5, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Randy", true, "" },
                    { 6, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Rhoge", true, "" },
                    { 7, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Vhenz", true, "" },
                    { 8, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Macky", true, "" },
                    { 9, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Ranzel", true, "" },
                    { 10, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Bhek", true, "" },
                    { 11, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Adriane", true, "" },
                    { 12, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Lerry", true, "" }
                });

            migrationBuilder.Sql(
                "UPDATE [Riders] SET [IsActive] = 0 WHERE [FullName] IN ('Kuya AL', 'Kuya Berto', 'Kuya Jun')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 21);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DropColumn(
                name: "IsTimeTbd",
                table: "Orders");

            migrationBuilder.UpdateData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "FullName", "PhoneNumber" },
                values: new object[] { "Kuya Berto", "09171234567" });

            migrationBuilder.UpdateData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "FullName", "PhoneNumber" },
                values: new object[] { "Kuya Jun", "09182345678" });

            migrationBuilder.UpdateData(
                table: "Riders",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "FullName", "PhoneNumber" },
                values: new object[] { "Kuya AL", "09193456789" });
        }
    }
}
