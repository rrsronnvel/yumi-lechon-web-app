namespace LechonSystem.Api.Data;

internal static class PayrollPhase21Schema
{
    internal const string UpgradeAndSeed = """
        DECLARE @payrollPhase21Lock int;
        EXEC @payrollPhase21Lock = sys.sp_getapplock @Resource = N'YumisLechon.Payroll',
            @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @payrollPhase21Lock < 0 THROW 51000, 'Could not acquire the payroll schema lock.', 1;

        IF COL_LENGTH(N'dbo.AttendanceDays', N'SuggestedOvertimeHours') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD SuggestedOvertimeHours decimal(5,2) NOT NULL DEFAULT (0);
        IF COL_LENGTH(N'dbo.AttendanceDays', N'OvertimeApprovedBy') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD OvertimeApprovedBy nvarchar(120) NULL;
        IF COL_LENGTH(N'dbo.AttendanceDays', N'OvertimeApprovedAt') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD OvertimeApprovedAt datetime2 NULL;
        IF COL_LENGTH(N'dbo.AttendanceDays', N'PendingOvertimePayOverride') IS NULL
            ALTER TABLE dbo.AttendanceDays ADD PendingOvertimePayOverride decimal(18,2) NULL;
        IF COL_LENGTH(N'dbo.AttendanceDays', N'OvertimeStatus') IS NULL
        BEGIN
            ALTER TABLE dbo.AttendanceDays ADD OvertimeStatus nvarchar(20) NOT NULL DEFAULT (N'None');
            -- Earlier payroll versions treated saved Owner-entered overtime as payable immediately.
            EXEC(N'UPDATE dbo.AttendanceDays
                SET OvertimeStatus = N''Approved'', OvertimeApprovedBy = LEFT(UpdatedBy, 120), OvertimeApprovedAt = UpdatedAt
                WHERE OvertimeHours > 0 OR OvertimePay > 0 OR IsOvertimePayOverridden = 1;');
        END;

        IF OBJECT_ID(N'dbo.DailyRoastTeams', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.DailyRoastTeams (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DailyRoastTeams PRIMARY KEY,
                DailyRoastProductionId int NOT NULL CONSTRAINT FK_DailyRoastTeams_DailyRoastProduction_DailyRoastProductionId
                    REFERENCES dbo.DailyRoastProduction (Id),
                TeamName nvarchar(80) NOT NULL,
                WholeLechonCount int NOT NULL,
                BellyCount int NOT NULL,
                EquivalentLechons int NOT NULL,
                GrossPartihanPool decimal(18,2) NOT NULL,
                TiktikRatePerLechonSnapshot decimal(18,2) NOT NULL DEFAULT (10),
                TiktikDeductionAmount decimal(18,2) NOT NULL DEFAULT (0),
                IsTiktikDeductionOverridden bit NOT NULL DEFAULT (0),
                NetPartihanPool decimal(18,2) NOT NULL,
                IsSuperseded bit NOT NULL DEFAULT (0),
                CreatedAt datetime2 NOT NULL,
                UpdatedAt datetime2 NULL
            );
            CREATE INDEX IX_DailyRoastTeams_DailyRoastProductionId ON dbo.DailyRoastTeams (DailyRoastProductionId);
        END;

        IF OBJECT_ID(N'dbo.DailyRoastTeamMembers', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.DailyRoastTeamMembers (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_DailyRoastTeamMembers PRIMARY KEY,
                DailyRoastTeamId int NOT NULL CONSTRAINT FK_DailyRoastTeamMembers_DailyRoastTeams_DailyRoastTeamId
                    REFERENCES dbo.DailyRoastTeams (Id),
                EmployeeId int NOT NULL CONSTRAINT FK_DailyRoastTeamMembers_Employees_EmployeeId REFERENCES dbo.Employees (Id),
                MemberRole nvarchar(12) NOT NULL DEFAULT (N'Roaster'),
                WeightSnapshot decimal(6,2) NOT NULL,
                AllocatedAmount decimal(18,2) NOT NULL,
                IsManualOverride bit NOT NULL DEFAULT (0),
                IsSuperseded bit NOT NULL DEFAULT (0)
            );
            CREATE UNIQUE INDEX IX_DailyRoastTeamMembers_DailyRoastTeamId_EmployeeId
                ON dbo.DailyRoastTeamMembers (DailyRoastTeamId, EmployeeId);
            CREATE INDEX IX_DailyRoastTeamMembers_EmployeeId ON dbo.DailyRoastTeamMembers (EmployeeId);
        END;

        -- Switch the original six-minute default once. Keep an Owner-edited grace period.
        IF NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE SettingKey = N'Payroll_LateTier1MaxMinutes')
            UPDATE dbo.SystemSettings SET SettingValue = N'10', UpdatedAt = SYSUTCDATETIME()
            WHERE SettingKey = N'Payroll_LateGraceMinutes' AND SettingValue = N'6' AND UpdatedBy = N'System';

        INSERT INTO dbo.SystemSettings (SettingKey, SettingValue, UpdatedBy, UpdatedAt)
        SELECT seed.SettingKey, seed.SettingValue, N'System', SYSUTCDATETIME()
        FROM (VALUES
            (N'Payroll_TiktikDeductionPerLechon', N'10'),
            (N'Payroll_LateGraceMinutes', N'10'),
            (N'Payroll_LateTier1MaxMinutes', N'30'),
            (N'Payroll_LateTier1Penalty', N'50'),
            (N'Payroll_LateTier2MaxMinutes', N'60'),
            (N'Payroll_LateTier2Penalty', N'100'),
            (N'Payroll_LateTier3Penalty', N'150'),
            (N'Payroll_RegularShiftTotalHours', N'9'),
            (N'Payroll_UnpaidOtBufferHours', N'1'),
            (N'Payroll_MinHoursForPaidOt', N'11')
        ) AS seed (SettingKey, SettingValue)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.SystemSettings s WHERE s.SettingKey = seed.SettingKey);
        """;
}
