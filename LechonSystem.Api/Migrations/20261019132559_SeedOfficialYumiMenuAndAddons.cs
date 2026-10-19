using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedOfficialYumiMenuAndAddons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "Name" },
                values: new object[] { 10000.00m, 15.0m, 3, "XXS" });

            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name" },
                values: new object[] { 11000.00m, 19.0m, 3, 16.0m, "XS" });

            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name" },
                values: new object[] { 12000.00m, 21.0m, 3, 20.0m, "S" });

            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name" },
                values: new object[] { 12700.00m, 24.0m, 3, 22.0m, "M" });

            migrationBuilder.InsertData(
                table: "ItemCategories",
                columns: new[] { "Id", "BasePrice", "CreatedAt", "IsActive", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name", "UpdatedAt" },
                values: new object[,]
                {
                    { 5, 13500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 27.0m, 3, 25.0m, "L", null },
                    { 6, 14000.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 30.0m, 3, 28.0m, "XL", null },
                    { 7, 15000.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 35.0m, 3, 32.0m, "XXL", null },
                    { 8, 16500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 40.0m, 3, 37.0m, "Jumbo", null },
                    { 9, 17500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 45.0m, 3, 41.0m, "S. Jumbo", null },
                    { 10, 1700.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 2.0m, 3, 2.0m, "Belly 2kg", null },
                    { 11, 2500.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 3.0m, 3, 3.0m, "Belly 3kg", null },
                    { 12, 3300.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 4.0m, 3, 4.0m, "Belly 4kg", null },
                    { 13, 4200.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 5.0m, 3, 5.0m, "Belly 5kg", null },
                    { 14, 50.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "Sarsa", null },
                    { 15, 50.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "1.5 L coke", null },
                    { 16, 50.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "Pancit", null },
                    { 17, 50.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "Palabok", null },
                    { 18, 50.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "Spaghetti", null },
                    { 19, 50.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "Dinuguan", null },
                    { 20, 50.00m, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), true, 0.0m, 0, 0.0m, "Puto", null }
                });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "Description", "Name", "SalangDurationMinutes" },
                values: new object[] { "XXS whole pig duration metrics", "XXS Profile", 150 });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Description", "Name", "SalangDurationMinutes" },
                values: new object[] { "XS whole pig duration metrics", "XS Profile", 150 });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "Description", "Name", "SalangDurationMinutes" },
                values: new object[] { "Small whole pig duration metrics", "S Profile", 150 });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "Description", "Name", "PackagingDurationMinutes", "SalangDurationMinutes", "TahiDurationMinutes" },
                values: new object[] { "Medium whole pig duration metrics", "M Profile", 30, 180, 60 });

            migrationBuilder.InsertData(
                table: "ProductCookingProfiles",
                columns: new[] { "Id", "CreatedAt", "Description", "ItemCategoryId", "Name", "PackagingDurationMinutes", "SalangDurationMinutes", "TahiDurationMinutes", "UpdatedAt" },
                values: new object[,]
                {
                    { 5, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Large whole pig duration metrics", 5, "L Profile", 30, 180, 60, null },
                    { 6, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "XL whole pig duration metrics", 6, "XL Profile", 30, 210, 60, null },
                    { 7, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "XXL whole pig duration metrics", 7, "XXL Profile", 30, 225, 60, null },
                    { 8, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Jumbo whole pig duration metrics", 8, "Jumbo Profile", 30, 270, 60, null },
                    { 9, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "S. Jumbo whole pig duration metrics", 9, "S. Jumbo Profile", 30, 300, 60, null },
                    { 10, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Belly 2kg duration metrics", 10, "Belly 2kg Profile", 15, 120, 30, null },
                    { 11, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Belly 3kg duration metrics", 11, "Belly 3kg Profile", 15, 120, 30, null },
                    { 12, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Belly 4kg duration metrics", 12, "Belly 4kg Profile", 15, 120, 30, null },
                    { 13, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Belly 5kg duration metrics", 13, "Belly 5kg Profile", 15, 135, 30, null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 16);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 17);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 18);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 19);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 20);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "Name" },
                values: new object[] { 4500.00m, 20.9m, 0, "Small Whole" });

            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name" },
                values: new object[] { 5500.00m, 25.9m, 0, 21.0m, "Medium Whole" });

            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name" },
                values: new object[] { 6500.00m, 30.9m, 0, 26.0m, "Large Whole" });

            migrationBuilder.UpdateData(
                table: "ItemCategories",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "BasePrice", "MaximumWeightKg", "MinimumSafetyStock", "MinimumWeightKg", "Name" },
                values: new object[] { 2500.00m, 5.9m, 0, 4.0m, "Lechon Belly - Medium" });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "Description", "Name", "SalangDurationMinutes" },
                values: new object[] { "Small whole pig duration metrics", "Small Profile", 120 });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Description", "Name", "SalangDurationMinutes" },
                values: new object[] { "Medium whole pig duration metrics", "Medium Profile", 180 });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "Description", "Name", "SalangDurationMinutes" },
                values: new object[] { "Large whole pig duration metrics", "Large Profile", 240 });

            migrationBuilder.UpdateData(
                table: "ProductCookingProfiles",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "Description", "Name", "PackagingDurationMinutes", "SalangDurationMinutes", "TahiDurationMinutes" },
                values: new object[] { "Standard belly duration metrics", "Belly Profile", 15, 90, 30 });
        }
    }
}
