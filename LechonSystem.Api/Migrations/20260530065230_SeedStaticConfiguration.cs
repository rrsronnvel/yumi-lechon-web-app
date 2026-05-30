using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedStaticConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "ItemCategories",
                columns: new[] { "Id", "BasePrice", "CreatedAt", "MaximumWeightKg", "MinimumWeightKg", "Name", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, 4500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 20.9m, 13.0m, "Small Whole", null },
                    { 2, 5500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 25.9m, 21.0m, "Medium Whole", null },
                    { 3, 6500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 30.9m, 26.0m, "Large Whole", null },
                    { 4, 2500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), 5.9m, 4.0m, "Lechon Belly - Medium", null }
                });

            migrationBuilder.InsertData(
                table: "ProductCookingProfiles",
                columns: new[] { "Id", "CreatedAt", "Description", "ItemCategoryId", "Name", "PackagingDurationMinutes", "SalangDurationMinutes", "TahiDurationMinutes", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Small whole pig duration metrics", 1, "Small Profile", 30, 120, 60, null },
                    { 2, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Medium whole pig duration metrics", 2, "Medium Profile", 30, 180, 60, null },
                    { 3, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Large whole pig duration metrics", 3, "Large Profile", 30, 240, 60, null },
                    { 4, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Standard belly duration metrics", 4, "Belly Profile", 15, 90, 30, null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 4);
        }
    }
}
