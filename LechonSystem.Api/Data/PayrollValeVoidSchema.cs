namespace LechonSystem.Api.Data;

internal static class PayrollValeVoidSchema
{
    internal const string AddAuditColumns = """
        DECLARE @payrollValeVoidLock int;
        EXEC @payrollValeVoidLock = sys.sp_getapplock @Resource = N'YumisLechon.Payroll',
            @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @payrollValeVoidLock < 0 THROW 51000, 'Could not acquire the payroll schema lock.', 1;

        IF COL_LENGTH(N'dbo.CashAdvanceLedger', N'IsVoided') IS NULL
            ALTER TABLE dbo.CashAdvanceLedger ADD IsVoided bit NOT NULL
                CONSTRAINT DF_CashAdvanceLedger_IsVoided DEFAULT (0) WITH VALUES;
        IF COL_LENGTH(N'dbo.CashAdvanceLedger', N'VoidedBy') IS NULL
            ALTER TABLE dbo.CashAdvanceLedger ADD VoidedBy nvarchar(120) NULL;
        IF COL_LENGTH(N'dbo.CashAdvanceLedger', N'VoidedAt') IS NULL
            ALTER TABLE dbo.CashAdvanceLedger ADD VoidedAt datetime2 NULL;
        IF COL_LENGTH(N'dbo.CashAdvanceLedger', N'VoidReason') IS NULL
            ALTER TABLE dbo.CashAdvanceLedger ADD VoidReason nvarchar(250) NULL;
        """;
}
