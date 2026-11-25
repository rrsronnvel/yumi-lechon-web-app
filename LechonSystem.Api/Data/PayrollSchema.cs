namespace LechonSystem.Api.Data;

internal static class PayrollSchema
{
    internal const string CreateAndSeed = """
        DECLARE @payrollSchemaLock int;
        EXEC @payrollSchemaLock = sys.sp_getapplock @Resource = N'YumisLechon.Payroll',
            @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @payrollSchemaLock < 0 THROW 51000, 'Could not acquire the payroll schema lock.', 1;

        IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.Employees (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Employees PRIMARY KEY,
                BiometricUserId int NOT NULL,
                FullName nvarchar(120) NOT NULL,
                Role nvarchar(24) NOT NULL,
                DailyRate decimal(18,2) NOT NULL,
                IsIncentiveEligible bit NOT NULL DEFAULT (0),
                IsActive bit NOT NULL DEFAULT (1),
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NULL
            );
            CREATE UNIQUE INDEX IX_Employees_BiometricUserId ON dbo.Employees (BiometricUserId);
        END;

        IF OBJECT_ID(N'dbo.BiometricImportBatches', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.BiometricImportBatches (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_BiometricImportBatches PRIMARY KEY,
                FileName nvarchar(255) NOT NULL,
                PeriodStart date NOT NULL,
                PeriodEnd date NOT NULL,
                PunchesImported int NOT NULL,
                DuplicatesSkipped int NOT NULL,
                UnmappedUserCount int NOT NULL,
                ImportedBy nvarchar(128) NOT NULL,
                ImportedAt datetime2 NOT NULL
            );
        END;

        IF OBJECT_ID(N'dbo.RawAttendancePunches', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.RawAttendancePunches (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RawAttendancePunches PRIMARY KEY,
                BiometricUserId int NOT NULL,
                BiometricNameSnapshot nvarchar(120) NULL,
                PunchTime datetime2 NOT NULL,
                ImportBatchId int NOT NULL CONSTRAINT FK_RawAttendancePunches_BiometricImportBatches_ImportBatchId
                    REFERENCES dbo.BiometricImportBatches (Id)
            );
            CREATE UNIQUE INDEX IX_RawAttendancePunches_BiometricUserId_PunchTime
                ON dbo.RawAttendancePunches (BiometricUserId, PunchTime);
            CREATE INDEX IX_RawAttendancePunches_ImportBatchId ON dbo.RawAttendancePunches (ImportBatchId);
            CREATE INDEX IX_RawAttendancePunches_PunchTime ON dbo.RawAttendancePunches (PunchTime);
        END;

        IF OBJECT_ID(N'dbo.AttendanceDays', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.AttendanceDays (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AttendanceDays PRIMARY KEY,
                EmployeeId int NOT NULL CONSTRAINT FK_AttendanceDays_Employees_EmployeeId REFERENCES dbo.Employees (Id),
                WorkDate date NOT NULL,
                TimeIn datetime2 NULL,
                TimeOut datetime2 NULL,
                TotalHours decimal(6,2) NOT NULL,
                DayCredit decimal(4,2) NOT NULL,
                OvertimePay decimal(18,2) NOT NULL DEFAULT (0),
                IsOvernightShift bit NOT NULL DEFAULT (0),
                ExceptionFlag nvarchar(24) NOT NULL,
                IsReviewed bit NOT NULL DEFAULT (0),
                IsManuallyOverridden bit NOT NULL DEFAULT (0),
                IsSuperseded bit NOT NULL DEFAULT (0),
                Notes nvarchar(1000) NULL,
                UpdatedBy nvarchar(128) NULL,
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NULL
            );
            CREATE UNIQUE INDEX IX_AttendanceDays_EmployeeId_WorkDate ON dbo.AttendanceDays (EmployeeId, WorkDate);
            CREATE INDEX IX_AttendanceDays_WorkDate ON dbo.AttendanceDays (WorkDate);
        END;

        IF OBJECT_ID(N'dbo.DailyRoastProduction', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.DailyRoastProduction (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DailyRoastProduction PRIMARY KEY,
                ProductionDate date NOT NULL,
                WholeLechonCount int NOT NULL,
                BellyCount int NOT NULL,
                BelliesPerWholeSnapshot int NOT NULL,
                QuotaSnapshot int NOT NULL,
                BonusPerExcessSnapshot decimal(18,2) NOT NULL,
                EquivalentLechons int NOT NULL,
                TotalBonusPool decimal(18,2) NOT NULL,
                UpdatedBy nvarchar(128) NULL,
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NULL
            );
            CREATE UNIQUE INDEX IX_DailyRoastProduction_ProductionDate ON dbo.DailyRoastProduction (ProductionDate);
        END;

        IF OBJECT_ID(N'dbo.PayrollPeriods', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.PayrollPeriods (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PayrollPeriods PRIMARY KEY,
                StartDate date NOT NULL,
                EndDate date NOT NULL,
                PayDate date NOT NULL,
                Status nvarchar(16) NOT NULL,
                TotalNetPay decimal(18,2) NOT NULL,
                FinalizedBy nvarchar(128) NULL,
                FinalizedAt datetime2 NULL,
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NULL
            );
            CREATE UNIQUE INDEX IX_PayrollPeriods_StartDate_EndDate ON dbo.PayrollPeriods (StartDate, EndDate);
        END;

        IF OBJECT_ID(N'dbo.PayrollItems', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.PayrollItems (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PayrollItems PRIMARY KEY,
                PayrollPeriodId int NOT NULL CONSTRAINT FK_PayrollItems_PayrollPeriods_PayrollPeriodId REFERENCES dbo.PayrollPeriods (Id),
                EmployeeId int NOT NULL CONSTRAINT FK_PayrollItems_Employees_EmployeeId REFERENCES dbo.Employees (Id),
                EmployeeNameSnapshot nvarchar(120) NOT NULL,
                DaysWorked decimal(5,2) NOT NULL,
                DailyRateSnapshot decimal(18,2) NOT NULL,
                BasePay decimal(18,2) NOT NULL,
                OvertimePay decimal(18,2) NOT NULL,
                RoastingIncentivePay decimal(18,2) NOT NULL,
                OtherBonus decimal(18,2) NOT NULL,
                OtherBonusRemarks nvarchar(1000) NULL,
                ValeBalanceBefore decimal(18,2) NOT NULL,
                ValeDeducted decimal(18,2) NOT NULL,
                ValeBalanceAfter decimal(18,2) NOT NULL,
                OtherDeduction decimal(18,2) NOT NULL,
                OtherDeductionRemarks nvarchar(1000) NULL,
                NetPay decimal(18,2) NOT NULL,
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NULL
            );
            CREATE UNIQUE INDEX IX_PayrollItems_PayrollPeriodId_EmployeeId ON dbo.PayrollItems (PayrollPeriodId, EmployeeId);
            CREATE INDEX IX_PayrollItems_EmployeeId ON dbo.PayrollItems (EmployeeId);
        END;

        IF OBJECT_ID(N'dbo.CashAdvanceLedger', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.CashAdvanceLedger (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CashAdvanceLedger PRIMARY KEY,
                EmployeeId int NOT NULL CONSTRAINT FK_CashAdvanceLedger_Employees_EmployeeId REFERENCES dbo.Employees (Id),
                TransactionDate date NOT NULL,
                Type nvarchar(24) NOT NULL,
                Amount decimal(18,2) NOT NULL CONSTRAINT CK_CashAdvanceLedger_PositiveAmount CHECK (Amount > 0),
                PayrollPeriodId int NULL CONSTRAINT FK_CashAdvanceLedger_PayrollPeriods_PayrollPeriodId REFERENCES dbo.PayrollPeriods (Id),
                Remarks nvarchar(1000) NULL,
                RecordedBy nvarchar(128) NOT NULL
            );
            CREATE INDEX IX_CashAdvanceLedger_EmployeeId_TransactionDate ON dbo.CashAdvanceLedger (EmployeeId, TransactionDate);
            CREATE UNIQUE INDEX IX_CashAdvanceLedger_PayrollPeriodId_EmployeeId
                ON dbo.CashAdvanceLedger (PayrollPeriodId, EmployeeId) WHERE PayrollPeriodId IS NOT NULL;
        END;

        INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, UpdatedBy, UpdatedAt)
        SELECT defaults.SettingKey, defaults.SettingValue, N'System', SYSUTCDATETIME()
        FROM (VALUES
            (N'Payroll_RoastQuota', N'4'),
            (N'Payroll_RoastBonusPerExcess', N'50'),
            (N'Payroll_BelliesPerWhole', N'3'),
            (N'Payroll_IncentiveSplitMode', N'SharedTeam')
        ) AS defaults (SettingKey, SettingValue)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.SystemSettings s WHERE s.SettingKey = defaults.SettingKey);
        """;
}
