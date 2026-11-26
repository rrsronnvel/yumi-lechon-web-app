using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

public static class KitchenCapacitySchema
{
    public static async Task InitializeAsync(LechonDbContext context)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await LockAsync(context);
        await context.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'KitchenBranches', N'U') IS NULL
            BEGIN
                CREATE TABLE KitchenBranches (
                    Id int IDENTITY PRIMARY KEY,
                    Code nvarchar(50) NOT NULL UNIQUE,
                    Name nvarchar(100) NOT NULL,
                    TotalPits int NOT NULL DEFAULT (14),
                    SafeBelliesPerPit int NOT NULL DEFAULT (3),
                    MaxSqueezeBelliesPerPit int NOT NULL DEFAULT (4),
                    PostDepartureBufferMinutes int NOT NULL DEFAULT (0),
                    IsActive bit NOT NULL DEFAULT (0),
                    IsDefault bit NOT NULL DEFAULT (0)
                );
            END;
            IF OBJECT_ID(N'KitchenBatchPresets', N'U') IS NULL
            BEGIN
                CREATE TABLE KitchenBatchPresets (
                    Id int IDENTITY PRIMARY KEY,
                    BranchCode nvarchar(50) NOT NULL,
                    ScheduleType nvarchar(50) NOT NULL,
                    BatchCode nvarchar(50) NOT NULL,
                    Label nvarchar(100) NOT NULL,
                    StartTime time NOT NULL,
                    EndTime time NOT NULL,
                    AnchorTime time NOT NULL,
                    MaxPits int NOT NULL DEFAULT (14),
                    IsActive bit NOT NULL DEFAULT (1),
                    SortOrder int NOT NULL,
                    CONSTRAINT UQ_KitchenBatchPresets_Branch_Batch UNIQUE (BranchCode, BatchCode)
                );
            END;
            IF COL_LENGTH('Orders', 'KitchenBranch') IS NULL
                ALTER TABLE Orders ADD KitchenBranch nvarchar(50) NOT NULL
                    CONSTRAINT DF_Orders_KitchenBranch DEFAULT (N'CARMONA');
            IF COL_LENGTH('Orders', 'KitchenBatchCode') IS NULL
                ALTER TABLE Orders ADD KitchenBatchCode nvarchar(50) NULL;
            IF COL_LENGTH('Orders', 'CapacityOverrideApproved') IS NULL
                ALTER TABLE Orders ADD CapacityOverrideApproved bit NOT NULL
                    CONSTRAINT DF_Orders_CapacityOverrideApproved DEFAULT (0);
            IF COL_LENGTH('Orders', 'CapacityOverrideReason') IS NULL
                ALTER TABLE Orders ADD CapacityOverrideReason nvarchar(250) NULL;
            """);
        await context.Database.ExecuteSqlRawAsync("""
            IF NOT EXISTS (SELECT 1 FROM KitchenBranches WHERE Code = N'CARMONA')
                INSERT INTO KitchenBranches (Code, Name, IsActive, IsDefault)
                VALUES (N'CARMONA', N'Carmona', 1, 1);
            IF NOT EXISTS (SELECT 1 FROM KitchenBranches WHERE Code = N'SILANG')
                INSERT INTO KitchenBranches (Code, Name, IsActive, IsDefault)
                VALUES (N'SILANG', N'Silang', 0, 0);

            INSERT INTO KitchenBatchPresets
                (BranchCode, ScheduleType, BatchCode, Label, StartTime, EndTime, AnchorTime, SortOrder)
            SELECT N'CARMONA', s.ScheduleType, s.BatchCode, s.Label, s.StartTime, s.EndTime, s.AnchorTime, s.SortOrder
            FROM (VALUES
                (N'PeakHoliday', N'PEAK_B1', N'Batch 1 (7:00 AM)',  '00:00', '08:30', '07:00', 1),
                (N'PeakHoliday', N'PEAK_B2', N'Batch 2 (10:00 AM)', '08:31', '12:00', '10:00', 2),
                (N'PeakHoliday', N'PEAK_B3', N'Batch 3 (2:00 PM)',  '12:01', '15:30', '14:00', 3),
                (N'PeakHoliday', N'PEAK_B4', N'Batch 4 (5:00 PM)',  '15:31', '18:30', '17:00', 4),
                (N'PeakHoliday', N'PEAK_B5', N'Batch 5 (8:00 PM)',  '18:31', '23:59', '20:00', 5),
                (N'Weekend', N'WKND_B1', N'Slot 1 (7:00 AM – 9:00 AM)',   '00:00', '09:59', '08:00', 1),
                (N'Weekend', N'WKND_B2', N'Slot 2 (10:00 AM – 12:00 PM)', '10:00', '12:59', '11:00', 2),
                (N'Weekend', N'WKND_B3', N'Slot 3 (1:00 PM – 3:00 PM)',   '13:00', '15:59', '14:00', 3),
                (N'Weekend', N'WKND_B4', N'Slot 4 (4:00 PM – 6:00 PM)',   '16:00', '23:59', '17:00', 4)
            ) s(ScheduleType, BatchCode, Label, StartTime, EndTime, AnchorTime, SortOrder)
            WHERE NOT EXISTS (
                SELECT 1 FROM KitchenBatchPresets b
                WHERE b.BranchCode = N'CARMONA' AND b.BatchCode = s.BatchCode
            );
            """);
        await transaction.CommitAsync();
    }

    public static Task LockAsync(LechonDbContext context) => context.Database.ExecuteSqlRawAsync("""
        DECLARE @lock int;
        EXEC @lock = sys.sp_getapplock @Resource = N'LechonKitchenCapacity', @LockMode = N'Exclusive',
            @LockOwner = N'Transaction', @LockTimeout = 15000;
        IF @lock < 0 THROW 51001, 'Kitchen capacity is busy. Please retry.', 1;
        """);
}
