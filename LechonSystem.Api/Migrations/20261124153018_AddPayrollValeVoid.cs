using LechonSystem.Api.Data;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LechonSystem.Api.Migrations;

public partial class AddPayrollValeVoid : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(PayrollValeVoidSchema.AddAuditColumns);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("The Vale schema is forward-only to preserve the void audit trail.");
}
