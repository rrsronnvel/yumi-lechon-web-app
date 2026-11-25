using LechonSystem.Api.Data;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations;

public partial class AddPayrollBiometrics : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(PayrollSchema.CreateAndSeed);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("The payroll schema is forward-only to preserve attendance and payroll history.");
}
