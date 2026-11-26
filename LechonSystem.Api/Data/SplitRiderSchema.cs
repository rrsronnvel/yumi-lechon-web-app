using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

public static class SplitRiderSchema
{
    public static Task InitializeAsync(LechonDbContext context) => context.Database.ExecuteSqlRawAsync("""
        IF COL_LENGTH('Orders', 'SupportRiderName') IS NULL
            ALTER TABLE Orders ADD SupportRiderName nvarchar(150) NULL;

        IF COL_LENGTH('Orders', 'SupportRiderFee') IS NULL
            ALTER TABLE Orders ADD SupportRiderFee decimal(18,2) NOT NULL
                CONSTRAINT DF_Orders_SupportRiderFee DEFAULT (0);

        IF COL_LENGTH('Orders', 'SupportRiderHeads') IS NULL
            ALTER TABLE Orders ADD SupportRiderHeads int NOT NULL
                CONSTRAINT DF_Orders_SupportRiderHeads DEFAULT (0);

        IF COL_LENGTH('Orders', 'SupportRiderExpenseId') IS NULL
            ALTER TABLE Orders ADD SupportRiderExpenseId int NULL;

        IF COL_LENGTH('OrderItemSchedules', 'AssignedRiderName') IS NULL
            ALTER TABLE OrderItemSchedules ADD AssignedRiderName nvarchar(150) NULL;
        """);

    public static Task LockOrderAsync(LechonDbContext context, int orderId)
    {
        var resource = $"LechonSplitRider:{orderId}";
        return context.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @lock int;
            EXEC @lock = sys.sp_getapplock @Resource = {resource}, @LockMode = N'Exclusive',
                @LockOwner = N'Transaction', @LockTimeout = 15000;
            IF @lock < 0 THROW 51002, 'Rider assignment or settlement is busy. Please retry.', 1;
            """);
    }
}
