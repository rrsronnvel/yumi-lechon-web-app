using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFreebiesPaymentChannelsAndOwnerConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "PaymentLogs",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Cash");

            migrationBuilder.AddColumn<string>(
                name: "DownpaymentMethod",
                table: "Orders",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.AddColumn<string>(
                name: "FreebiesConfigJson",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FreebiesSummary",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOwnerConfirmed",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OwnerConfirmedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerConfirmedBy",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE PaymentLogs
                SET PaymentMethod = CASE Provider
                    WHEN 1 THEN 'GCash'
                    WHEN 2 THEN 'GCash'
                    WHEN 3 THEN 'GCash'
                    WHEN 4 THEN 'Bank Transfer'
                    WHEN 5 THEN 'Maya'
                    ELSE 'Cash'
                END;

                UPDATE o
                SET DownpaymentMethod = CASE
                        WHEN o.Downpayment <= 0 THEN 'None'
                        ELSE COALESCE((
                            SELECT TOP (1) p.PaymentMethod
                            FROM PaymentLogs p
                            WHERE p.OrderId = o.Id AND p.Status = 1
                            ORDER BY p.CreatedAt, p.Id
                        ), 'GCash')
                    END,
                    IsOwnerConfirmed = 1,
                    OwnerConfirmedAt = COALESCE(o.OwnerConfirmedAt, o.CreatedAt),
                    OwnerConfirmedBy = COALESCE(o.OwnerConfirmedBy, 'Migration')
                FROM Orders o;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "PaymentLogs");

            migrationBuilder.DropColumn(
                name: "DownpaymentMethod",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FreebiesConfigJson",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "FreebiesSummary",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IsOwnerConfirmed",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OwnerConfirmedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OwnerConfirmedBy",
                table: "Orders");
        }
    }
}
