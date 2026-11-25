using LechonSystem.Api.Data;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations;

public partial class AlignPayrollPhase21 : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(PayrollPhase21Schema.UpgradeAndSeed);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("The payroll schema is forward-only to preserve team and overtime history.");
}
