using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class BackfillCorruptedOrderItemPrices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_ProductCookingProfiles_ItemCategoryId",
                table: "ProductCookingProfiles",
                column: "ItemCategoryId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductCookingProfiles_ItemCategories_ItemCategoryId",
                table: "ProductCookingProfiles",
                column: "ItemCategoryId",
                principalTable: "ItemCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.Sql(@"
                UPDATE oi
                SET oi.Price = ic.BasePrice,
                    oi.TotalPrice = ic.BasePrice * oi.Quantity
                FROM OrderItems oi
                INNER JOIN ItemCategories ic ON oi.ItemCategoryId = ic.Id
                INNER JOIN Orders o ON oi.OrderId = o.Id
                WHERE oi.Price = 0 AND o.IsCancelled = 0 AND o.TargetDeliveryTime >= CAST(GETDATE() AS DATE);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductCookingProfiles_ItemCategories_ItemCategoryId",
                table: "ProductCookingProfiles");

            migrationBuilder.DropIndex(
                name: "IX_ProductCookingProfiles_ItemCategoryId",
                table: "ProductCookingProfiles");
        }
    }
}
