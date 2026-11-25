namespace LechonSystem.Api.Data;

internal static class PayrollPhase2Schema
{
    internal const string UpgradeAndSeed = """
        SET ANSI_NULLS ON;
        SET ANSI_PADDING ON;
        SET ANSI_WARNINGS ON;
        SET ARITHABORT ON;
        SET CONCAT_NULL_YIELDS_NULL ON;
        SET NUMERIC_ROUNDABORT OFF;
        SET QUOTED_IDENTIFIER ON;

        DECLARE @payrollPhase2Lock int;
        EXEC @payrollPhase2Lock = sys.sp_getapplock @Resource = N'YumisLechon.Payroll',
            @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @payrollPhase2Lock < 0 THROW 51000, 'Could not acquire the payroll schema lock.', 1;

        IF COL_LENGTH(N'dbo.Employees', N'IncentiveTier') IS NULL
            ALTER TABLE dbo.Employees ADD IncentiveTier nvarchar(12) NOT NULL DEFAULT (N'None');
        IF COL_LENGTH(N'dbo.Employees', N'IncentiveWeight') IS NULL
            ALTER TABLE dbo.Employees ADD IncentiveWeight decimal(6,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.Employees', N'HasMilestoneBonus') IS NULL
            ALTER TABLE dbo.Employees ADD HasMilestoneBonus bit NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.Employees', N'DefaultShiftStartTime') IS NULL
            ALTER TABLE dbo.Employees ADD DefaultShiftStartTime time NULL;

        IF COL_LENGTH(N'dbo.AttendanceDays', N'OvertimeHours') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD OvertimeHours decimal(5,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.AttendanceDays', N'IsOvertimePayOverridden') IS NULL
        BEGIN
                ALTER TABLE dbo.AttendanceDays ADD IsOvertimePayOverridden bit NOT NULL DEFAULT (0);
            EXEC(N'UPDATE dbo.AttendanceDays SET IsOvertimePayOverridden = 1 WHERE OvertimePay > 0;');
        END;
        IF COL_LENGTH(N'dbo.AttendanceDays', N'DayType') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD DayType nvarchar(16) NOT NULL DEFAULT (N'Regular');
        IF COL_LENGTH(N'dbo.AttendanceDays', N'DayTypeOverride') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD DayTypeOverride nvarchar(16) NULL;
        IF COL_LENGTH(N'dbo.AttendanceDays', N'HolidayPremiumPay') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD HolidayPremiumPay decimal(18,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.AttendanceDays', N'ScheduledStartTime') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD ScheduledStartTime time NULL;
        IF COL_LENGTH(N'dbo.AttendanceDays', N'LateMinutes') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD LateMinutes int NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.AttendanceDays', N'LateDeduction') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD LateDeduction decimal(18,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.AttendanceDays', N'IsLateExcused') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD IsLateExcused bit NOT NULL DEFAULT (0);

        IF COL_LENGTH(N'dbo.DailyRoastProduction', N'UsesDualIncentives') IS NULL
            ALTER TABLE dbo.DailyRoastProduction ADD UsesDualIncentives bit NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.DailyRoastProduction', N'PartihanEnabledSnapshot') IS NULL
            ALTER TABLE dbo.DailyRoastProduction ADD PartihanEnabledSnapshot bit NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.DailyRoastProduction', N'MilestoneBonusEnabledSnapshot') IS NULL
            ALTER TABLE dbo.DailyRoastProduction ADD MilestoneBonusEnabledSnapshot bit NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.DailyRoastProduction', N'PartihanRatePerLechonSnapshot') IS NULL
            ALTER TABLE dbo.DailyRoastProduction ADD PartihanRatePerLechonSnapshot decimal(18,2) NOT NULL DEFAULT (50);
        IF COL_LENGTH(N'dbo.DailyRoastProduction', N'PartihanPool') IS NULL
            ALTER TABLE dbo.DailyRoastProduction ADD PartihanPool decimal(18,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.DailyRoastProduction', N'MilestoneStepSnapshot') IS NULL
            ALTER TABLE dbo.DailyRoastProduction ADD MilestoneStepSnapshot int NOT NULL DEFAULT (10);
        IF COL_LENGTH(N'dbo.DailyRoastProduction', N'MilestoneBonusAmountSnapshot') IS NULL
            ALTER TABLE dbo.DailyRoastProduction ADD MilestoneBonusAmountSnapshot decimal(18,2) NOT NULL DEFAULT (100);

        IF COL_LENGTH(N'dbo.PayrollPeriods', N'CycleType') IS NULL
            ALTER TABLE dbo.PayrollPeriods ADD CycleType nvarchar(16) NOT NULL DEFAULT (N'Weekly');
        IF COL_LENGTH(N'dbo.PayrollPeriods', N'TotalLaborExpense') IS NULL
        BEGIN
            ALTER TABLE dbo.PayrollPeriods ADD TotalLaborExpense decimal(18,2) NOT NULL DEFAULT (0);
            EXEC(N'UPDATE periods SET TotalLaborExpense = periods.TotalNetPay + COALESCE(totals.Settled, 0)
                   FROM dbo.PayrollPeriods periods
                   OUTER APPLY (SELECT SUM(items.ValeDeducted) AS Settled FROM dbo.PayrollItems items
                                WHERE items.PayrollPeriodId = periods.Id) totals
                   WHERE periods.Status = N''Finalized'';');
        END;
        IF COL_LENGTH(N'dbo.PayrollPeriods', N'SyncedExpenseId') IS NULL
            ALTER TABLE dbo.PayrollPeriods ADD SyncedExpenseId int NULL;

        IF COL_LENGTH(N'dbo.PayrollItems', N'HolidayPremiumPay') IS NULL
            ALTER TABLE dbo.PayrollItems ADD HolidayPremiumPay decimal(18,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.PayrollItems', N'LateDeduction') IS NULL
            ALTER TABLE dbo.PayrollItems ADD LateDeduction decimal(18,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.PayrollItems', N'PartihanIncentivePay') IS NULL
        BEGIN
            ALTER TABLE dbo.PayrollItems ADD PartihanIncentivePay decimal(18,2) NOT NULL DEFAULT (0);
            EXEC(N'UPDATE dbo.PayrollItems SET PartihanIncentivePay = RoastingIncentivePay WHERE RoastingIncentivePay <> 0;');
        END;
        IF COL_LENGTH(N'dbo.PayrollItems', N'MilestoneIncentivePay') IS NULL
            ALTER TABLE dbo.PayrollItems ADD MilestoneIncentivePay decimal(18,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.PayrollItems', N'IsValeDeductionManuallyOverridden') IS NULL
        BEGIN
                ALTER TABLE dbo.PayrollItems ADD IsValeDeductionManuallyOverridden bit NOT NULL DEFAULT (0);
            EXEC(N'UPDATE dbo.PayrollItems SET IsValeDeductionManuallyOverridden = 1 WHERE ValeDeducted > 0;');
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.PayrollPeriods')
                       AND name = N'IX_PayrollPeriods_SyncedExpenseId')
            EXEC(N'CREATE UNIQUE INDEX IX_PayrollPeriods_SyncedExpenseId
                   ON dbo.PayrollPeriods (SyncedExpenseId) WHERE SyncedExpenseId IS NOT NULL;');

        -- Older installations create Expenses at startup. Add the FK whenever that table is available.
        IF OBJECT_ID(N'dbo.Expenses', N'U') IS NOT NULL
            AND OBJECT_ID(N'dbo.FK_PayrollPeriods_Expenses_SyncedExpenseId', N'F') IS NULL
            EXEC(N'ALTER TABLE dbo.PayrollPeriods ADD CONSTRAINT FK_PayrollPeriods_Expenses_SyncedExpenseId
                   FOREIGN KEY (SyncedExpenseId) REFERENCES dbo.Expenses (Id);');

        IF OBJECT_ID(N'dbo.DailyRoastAllocations', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.DailyRoastAllocations (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DailyRoastAllocations PRIMARY KEY,
                DailyRoastProductionId int NOT NULL CONSTRAINT FK_DailyRoastAllocations_DailyRoastProduction_DailyRoastProductionId
                    REFERENCES dbo.DailyRoastProduction (Id),
                EmployeeId int NOT NULL CONSTRAINT FK_DailyRoastAllocations_Employees_EmployeeId REFERENCES dbo.Employees (Id),
                TierSnapshot nvarchar(12) NOT NULL,
                WeightSnapshot decimal(6,2) NOT NULL,
                PartihanAmount decimal(18,2) NOT NULL,
                MilestoneBonusAmount decimal(18,2) NOT NULL,
                TotalIncentiveAmount decimal(18,2) NOT NULL,
                IsManualOverride bit NOT NULL DEFAULT (0),
                IsSuperseded bit NOT NULL DEFAULT (0)
            );
            CREATE UNIQUE INDEX IX_DailyRoastAllocations_DailyRoastProductionId_EmployeeId
                ON dbo.DailyRoastAllocations (DailyRoastProductionId, EmployeeId);
            CREATE INDEX IX_DailyRoastAllocations_EmployeeId ON dbo.DailyRoastAllocations (EmployeeId);
        END;

        IF OBJECT_ID(N'dbo.PayrollHolidays', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.PayrollHolidays (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PayrollHolidays PRIMARY KEY,
                HolidayDate date NOT NULL,
                Name nvarchar(120) NOT NULL,
                HolidayType nvarchar(16) NOT NULL,
                IsActive bit NOT NULL DEFAULT (1)
            );
            CREATE UNIQUE INDEX IX_PayrollHolidays_HolidayDate ON dbo.PayrollHolidays (HolidayDate);
        END;

        INSERT INTO dbo.PayrollHolidays (HolidayDate, Name, HolidayType, IsActive)
        SELECT seed.HolidayDate, seed.Name, seed.HolidayType, 1
        FROM (VALUES
            (CONVERT(date, '20261224', 112), N'Christmas Eve', N'SpecialHoliday'),
            (CONVERT(date, '20261225', 112), N'Christmas Day', N'RegularHoliday'),
            (CONVERT(date, '20261230', 112), N'Rizal Day', N'RegularHoliday'),
            (CONVERT(date, '20261231', 112), N'New Year''s Eve', N'SpecialHoliday'),
            (CONVERT(date, '20270101', 112), N'New Year''s Day', N'RegularHoliday')
        ) AS seed (HolidayDate, Name, HolidayType)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.PayrollHolidays h WHERE h.HolidayDate = seed.HolidayDate);

        -- Adopt the new ratio once for a store still on the untouched Phase 1 default.
        IF NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = N'Payroll_EnablePartihan')
            UPDATE dbo.SystemSettings
            SET SettingValue = N'2', UpdatedAt = SYSUTCDATETIME()
            WHERE SettingKey = N'Payroll_BelliesPerWhole' AND SettingValue = N'3' AND UpdatedBy = N'System';

        INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, UpdatedBy, UpdatedAt)
        SELECT seed.SettingKey, seed.SettingValue, N'System', SYSUTCDATETIME()
        FROM (VALUES
            (N'Payroll_BelliesPerWhole', N'2'),
            (N'Payroll_EnablePartihan', N'true'),
            (N'Payroll_PartihanRatePerLechon', N'50'),
            (N'Payroll_EnableMilestoneBonus', N'true'),
            (N'Payroll_MilestoneUnitLechons', N'10'),
            (N'Payroll_MilestoneBonusAmount', N'100'),
            (N'Payroll_StandardWorkHoursPerDay', N'8'),
            (N'Payroll_OvertimeMultiplier', N'1.25'),
            (N'Payroll_EnableHolidayPay', N'false'),
            (N'Payroll_SpecialHolidayMultiplier', N'1.30'),
            (N'Payroll_RegularHolidayMultiplier', N'2.00'),
            (N'Payroll_EnableLateDeduction', N'false'),
            (N'Payroll_LateGraceMinutes', N'6'),
            (N'Payroll_LatePenaltyAmount', N'50'),
            (N'Payroll_EnableValeSystem', N'true'),
            (N'Payroll_ValeAllowedDayOfWeek', N'Wednesday'),
            (N'Payroll_EnforceValeEarnedCap', N'true'),
            (N'Payroll_AutoDeductValeOnPayroll', N'true'),
            (N'Payroll_SyncToExpensesOnFinalize', N'true')
        ) AS seed (SettingKey, SettingValue)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.SystemSettings s WHERE s.SettingKey = seed.SettingKey);
        """;
}
