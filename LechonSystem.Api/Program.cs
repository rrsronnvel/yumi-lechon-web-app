using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Services;
using LechonSystem.Api.Interfaces;
using LechonSystem.Api.Models;
using LechonSystem.Api.Common;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, "appsettings.json"), optional: true)
    .AddJsonFile(Path.Combine(AppContext.BaseDirectory, $"appsettings.{builder.Environment.EnvironmentName}.json"), optional: true);

// ==========================================
// PHASE 1: THE CONFIGURATION MIXING BOWL
// All 'builder.Services' must stay up here!
// ==========================================

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<LechonDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ISchedulingService, SchedulingService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IRoastingService, RoastingService>();
builder.Services.AddScoped<ILogisticsService, LogisticsService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<IProcurementService, ProcurementService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<INotificationSender, SmsNotificationService>();
builder.Services.AddScoped<ICmsService, CmsService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<IAiIntakeParserService, AiIntakeParserService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();

// 🟢 MOVE CORS CONFIGURATION HERE (Before builder.Build)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();

var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});
builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddOpenApi();

// ==========================================
// THE POINT OF NO RETURN
// This bakes the services container permanently
// ==========================================
var app = builder.Build(); 

// ==========================================
// STARTUP DATA REPAIR: Backfill 0.00 OrderItem prices
// ==========================================
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<LechonDbContext>();

    // Additive expense-ledger schema. Every guard is idempotent so startup can
    // safely upgrade an existing database without deleting or replacing records.
    await context.Database.ExecuteSqlRawAsync(@"
        IF OBJECT_ID(N'Expenses', N'U') IS NULL
        BEGIN
            CREATE TABLE Expenses (
                Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Expenses PRIMARY KEY
            );
        END;

        IF COL_LENGTH('Expenses', 'Id') IS NULL
            ALTER TABLE Expenses ADD Id int IDENTITY(1,1) NOT NULL;

        IF NOT EXISTS (
            SELECT 1 FROM sys.key_constraints
            WHERE [type] = 'PK'
              AND parent_object_id = OBJECT_ID(N'Expenses'))
            ALTER TABLE Expenses ADD CONSTRAINT PK_Expenses PRIMARY KEY (Id);

        IF COL_LENGTH('Expenses', 'ExpenseDate') IS NULL
            ALTER TABLE Expenses ADD ExpenseDate datetime2 NOT NULL
                CONSTRAINT DF_Expenses_ExpenseDate DEFAULT ('2000-01-01') WITH VALUES;

        IF COL_LENGTH('Expenses', 'Category') IS NULL
            ALTER TABLE Expenses ADD Category nvarchar(100) NOT NULL
                CONSTRAINT DF_Expenses_Category DEFAULT (N'Others') WITH VALUES;

        IF COL_LENGTH('Expenses', 'CostType') IS NULL
            ALTER TABLE Expenses ADD CostType nvarchar(20) NOT NULL
                CONSTRAINT DF_Expenses_CostType DEFAULT (N'OPEX') WITH VALUES;

        IF COL_LENGTH('Expenses', 'ItemDescription') IS NULL
            ALTER TABLE Expenses ADD ItemDescription nvarchar(250) NOT NULL
                CONSTRAINT DF_Expenses_ItemDescription DEFAULT (N'Unspecified expense') WITH VALUES;

        IF COL_LENGTH('Expenses', 'Quantity') IS NULL
            ALTER TABLE Expenses ADD Quantity decimal(18,2) NULL;

        IF COL_LENGTH('Expenses', 'Unit') IS NULL
            ALTER TABLE Expenses ADD Unit nvarchar(50) NULL;

        IF COL_LENGTH('Expenses', 'UnitCost') IS NULL
            ALTER TABLE Expenses ADD UnitCost decimal(18,2) NULL;

        IF COL_LENGTH('Expenses', 'TotalCost') IS NULL
            ALTER TABLE Expenses ADD TotalCost decimal(18,2) NOT NULL
                CONSTRAINT DF_Expenses_TotalCost DEFAULT (0) WITH VALUES;

        IF COL_LENGTH('Expenses', 'PaymentMethod') IS NULL
            ALTER TABLE Expenses ADD PaymentMethod nvarchar(50) NOT NULL
                CONSTRAINT DF_Expenses_PaymentMethod DEFAULT (N'Cash') WITH VALUES;

        IF COL_LENGTH('Expenses', 'Remarks') IS NULL
            ALTER TABLE Expenses ADD Remarks nvarchar(500) NULL;

        IF COL_LENGTH('Expenses', 'EncodedBy') IS NULL
            ALTER TABLE Expenses ADD EncodedBy nvarchar(128) NOT NULL
                CONSTRAINT DF_Expenses_EncodedBy DEFAULT (N'System') WITH VALUES;

        IF COL_LENGTH('Expenses', 'CreatedAt') IS NULL
            ALTER TABLE Expenses ADD CreatedAt datetime2 NOT NULL
                CONSTRAINT DF_Expenses_CreatedAt DEFAULT (SYSUTCDATETIME()) WITH VALUES;

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = N'IX_Expenses_ExpenseDate'
              AND object_id = OBJECT_ID(N'Expenses'))
            CREATE INDEX IX_Expenses_ExpenseDate ON Expenses (ExpenseDate);
    ");

    // Explicit November 2026 QA ledger. The natural-tuple NOT EXISTS guard makes
    // this insert-only and safe to run repeatedly alongside real store records.
    // It is intentionally local/development-only so production databases never
    // receive hard-coded QA expenses.
    if (app.Environment.IsDevelopment())
    {
        await context.Database.ExecuteSqlRawAsync(@"
        DECLARE @ExpenseSeed TABLE (
            ExpenseDate datetime2 NOT NULL,
            Category nvarchar(100) NOT NULL,
            CostType nvarchar(20) NOT NULL,
            ItemDescription nvarchar(250) NOT NULL,
            Quantity decimal(18,2) NULL,
            Unit nvarchar(50) NULL,
            TotalCost decimal(18,2) NOT NULL,
            PaymentMethod nvarchar(50) NOT NULL,
            Remarks nvarchar(500) NULL
        );

        INSERT INTO @ExpenseSeed
            (ExpenseDate, Category, CostType, ItemDescription, Quantity, Unit, TotalCost, PaymentMethod, Remarks)
        VALUES
            ('2026-11-01', N'Packaging', N'COGS', N'Packaging /tape', 4, N'pcs', 2504.00, N'Cash', N''),
            ('2026-11-02', N'Owner / Non-Operating Outflow', N'NON_OP', N'Resort DP', NULL, NULL, 8000.00, N'Cash', N''),
            ('2026-11-02', N'Marketing', N'OPEX', N'Meta Verified', NULL, NULL, 2850.00, N'Cash', N''),
            ('2026-11-03', N'Meat / Main Products', N'COGS', N'Manok', 30, N'pcs', 6649.00, N'GCash', N''),
            ('2026-11-03', N'Labor', N'OPEX', N'Ate Salary', NULL, NULL, 2510.00, N'GCash', N''),
            ('2026-11-03', N'Ingredients & Freebies', N'COGS', N'Puregold', NULL, NULL, 10120.00, N'Cash', N''),
            ('2026-11-03', N'Utilities', N'OPEX', N'Meralco Lechonan', NULL, NULL, 22483.39, N'GCash', N''),
            ('2026-11-03', N'Packaging', N'COGS', N'Lechon Belly Box', 5, N'pcs', 1457.00, N'Cash', N'Shopee'),
            ('2026-11-05', N'Equipment & Supplies', N'OPEX', N'Tablet', 1, N'pcs', 22000.00, N'Cash', N''),
            ('2026-11-05', N'Meat / Main Products', N'COGS', N'Belly', NULL, NULL, 11848.00, N'GCash', N''),
            ('2026-11-06', N'Rent', N'OPEX', N'Kitchen Park Rent', NULL, NULL, 10000.00, N'Cash', N''),
            ('2026-11-07', N'Ingredients & Freebies', N'COGS', N'Fluid - Coke 1.5', NULL, NULL, 5124.00, N'Cash', N''),
            ('2026-11-07', N'Ingredients & Freebies', N'COGS', N'Palabok', NULL, NULL, 6250.00, N'Cash', N''),
            ('2026-11-07', N'Packaging', N'COGS', N'Manila Paper', 50, N'pcs', 2814.00, N'Cash', N'Shopee'),
            ('2026-11-07', N'Owner / Non-Operating Outflow', N'NON_OP', N'Paluwagan', NULL, NULL, 3500.00, N'Cash', N''),
            ('2026-11-08', N'Owner / Non-Operating Outflow', N'NON_OP', N'Expenses from Tita Elay', NULL, NULL, 11500.00, N'Cash', N''),
            ('2026-11-10', N'Meat / Main Products', N'COGS', N'Live Pigs (Buong Baboy - Batch Katay)', 10, N'heads', 65000.00, N'Cash', N'Biyahero Batangas');

        INSERT INTO Expenses
            (ExpenseDate, Category, CostType, ItemDescription, Quantity, Unit, UnitCost,
             TotalCost, PaymentMethod, Remarks, EncodedBy, CreatedAt)
        SELECT seed.ExpenseDate, seed.Category, seed.CostType, seed.ItemDescription,
               seed.Quantity, seed.Unit, NULL, seed.TotalCost, seed.PaymentMethod,
               seed.Remarks, N'System QA Seed', '2026-11-13T00:00:00'
        FROM @ExpenseSeed seed
        WHERE NOT EXISTS (
            SELECT 1
            FROM Expenses existing
            WHERE existing.ExpenseDate = seed.ExpenseDate
              AND existing.Category = seed.Category
              AND existing.ItemDescription = seed.ItemDescription
              AND existing.TotalCost = seed.TotalCost
              AND ISNULL(existing.Quantity, -1) = ISNULL(seed.Quantity, -1)
              AND ISNULL(existing.Unit, N'') = ISNULL(seed.Unit, N'')
        );
        ");
    }

    var accountant = await context.Users
        .FirstOrDefaultAsync(user => user.Username.ToLower() == "accountant");
    if (accountant == null)
    {
        var now = DateTime.UtcNow;
        context.Users.Add(new User
        {
            Username = "accountant",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("accountant123"),
            FullName = "Store Accountant",
            Role = "Accountant",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        });
        await context.SaveChangesAsync();
    }

    await context.Database.ExecuteSqlRawAsync(@"
        IF COL_LENGTH('Orders', 'HeldByStaffAmount') IS NULL
            ALTER TABLE Orders ADD HeldByStaffAmount decimal(18,2) NULL;

        IF COL_LENGTH('Orders', 'DigitalTransferMethod') IS NULL
            ALTER TABLE Orders ADD DigitalTransferMethod nvarchar(50) NULL;

        IF COL_LENGTH('Orders', 'DigitalTransferAmount') IS NULL
            ALTER TABLE Orders ADD DigitalTransferAmount decimal(18,2) NULL;

        IF COL_LENGTH('Orders', 'DigitalReferenceNote') IS NULL
            ALTER TABLE Orders ADD DigitalReferenceNote nvarchar(256) NULL;

        IF COL_LENGTH('Orders', 'IsDpRemittedToOwner') IS NULL
            ALTER TABLE Orders ADD IsDpRemittedToOwner bit NOT NULL
                CONSTRAINT DF_Orders_IsDpRemittedToOwner DEFAULT (0);

        IF COL_LENGTH('Orders', 'DpRemittedAt') IS NULL
            ALTER TABLE Orders ADD DpRemittedAt datetime2 NULL;

        IF COL_LENGTH('Orders', 'DpRemittedBy') IS NULL
            ALTER TABLE Orders ADD DpRemittedBy nvarchar(128) NULL;

        IF COL_LENGTH('Orders', 'AssistedByAdmin') IS NULL
            ALTER TABLE Orders ADD AssistedByAdmin nvarchar(64) NULL;

        IF COL_LENGTH('OrderItemSchedules', 'CustomWeightDisplay') IS NULL
            ALTER TABLE OrderItemSchedules ADD CustomWeightDisplay nvarchar(32) NULL;

        IF COL_LENGTH('OrderItems', 'FulfilledItemCategoryId') IS NULL
            ALTER TABLE OrderItems ADD FulfilledItemCategoryId int NULL;

        IF COL_LENGTH('PaymentLogs', 'RecordedBy') IS NULL
            ALTER TABLE PaymentLogs ADD RecordedBy nvarchar(128) NULL;

        IF OBJECT_ID('KitchenPrepRequests', 'U') IS NULL
        BEGIN
            CREATE TABLE KitchenPrepRequests (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                TargetDate DATETIME2 NOT NULL,
                TargetTime DATETIME2 NOT NULL,
                Category NVARCHAR(64) NOT NULL,
                RecipientOrLabel NVARCHAR(150) NOT NULL,
                ItemsJson NVARCHAR(MAX) NOT NULL,
                Remarks NVARCHAR(500) NULL,
                CreatedBy NVARCHAR(100) NOT NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
            );
        END
    ");

    // Idempotent text repair only: correct known historical UTF-8/Windows-1252
    // mojibake without deleting records or changing unrelated order data.
    await context.Database.ExecuteSqlRawAsync(@"
        DECLARE @BadGift nvarchar(8) = NCHAR(240) + NCHAR(376) + NCHAR(381) + NCHAR(129);
        DECLARE @BadGiftC1 nvarchar(8) = NCHAR(240) + NCHAR(159) + NCHAR(142) + NCHAR(129);
        DECLARE @Gift nvarchar(8) = N'🎁';
        DECLARE @BadPeso nvarchar(8) = NCHAR(226) + NCHAR(8218) + NCHAR(177);
        DECLARE @BadPesoC1 nvarchar(8) = NCHAR(226) + NCHAR(130) + NCHAR(177);
        DECLARE @Peso nvarchar(8) = N'₱';

        IF COL_LENGTH('Orders', 'Remarks') IS NOT NULL
            EXEC sys.sp_executesql N'
                UPDATE Orders
                SET Remarks = REPLACE(REPLACE(REPLACE(REPLACE(Remarks,
                    @BadGift, @Gift), @BadGiftC1, @Gift), @BadPeso, @Peso), @BadPesoC1, @Peso)
                WHERE Remarks LIKE N''%'' + @BadGift + N''%''
                   OR Remarks LIKE N''%'' + @BadGiftC1 + N''%''
                   OR Remarks LIKE N''%'' + @BadPeso + N''%''
                   OR Remarks LIKE N''%'' + @BadPesoC1 + N''%'';',
                N'@BadGift nvarchar(8), @BadGiftC1 nvarchar(8), @Gift nvarchar(8), @BadPeso nvarchar(8), @BadPesoC1 nvarchar(8), @Peso nvarchar(8)',
                @BadGift, @BadGiftC1, @Gift, @BadPeso, @BadPesoC1, @Peso;

        IF COL_LENGTH('Orders', 'KitchenInstructions') IS NOT NULL
            EXEC sys.sp_executesql N'
                UPDATE Orders
                SET KitchenInstructions = REPLACE(REPLACE(REPLACE(REPLACE(KitchenInstructions,
                    @BadGift, @Gift), @BadGiftC1, @Gift), @BadPeso, @Peso), @BadPesoC1, @Peso)
                WHERE KitchenInstructions LIKE N''%'' + @BadGift + N''%''
                   OR KitchenInstructions LIKE N''%'' + @BadGiftC1 + N''%''
                   OR KitchenInstructions LIKE N''%'' + @BadPeso + N''%''
                   OR KitchenInstructions LIKE N''%'' + @BadPesoC1 + N''%'';',
                N'@BadGift nvarchar(8), @BadGiftC1 nvarchar(8), @Gift nvarchar(8), @BadPeso nvarchar(8), @BadPesoC1 nvarchar(8), @Peso nvarchar(8)',
                @BadGift, @BadGiftC1, @Gift, @BadPeso, @BadPesoC1, @Peso;

        IF COL_LENGTH('Orders', 'FreebiesSummary') IS NOT NULL
            EXEC sys.sp_executesql N'
                UPDATE Orders
                SET FreebiesSummary = REPLACE(REPLACE(REPLACE(REPLACE(FreebiesSummary,
                    @BadGift, @Gift), @BadGiftC1, @Gift), @BadPeso, @Peso), @BadPesoC1, @Peso)
                WHERE FreebiesSummary LIKE N''%'' + @BadGift + N''%''
                   OR FreebiesSummary LIKE N''%'' + @BadGiftC1 + N''%''
                   OR FreebiesSummary LIKE N''%'' + @BadPeso + N''%''
                   OR FreebiesSummary LIKE N''%'' + @BadPesoC1 + N''%'';',
                N'@BadGift nvarchar(8), @BadGiftC1 nvarchar(8), @Gift nvarchar(8), @BadPeso nvarchar(8), @BadPesoC1 nvarchar(8), @Peso nvarchar(8)',
                @BadGift, @BadGiftC1, @Gift, @BadPeso, @BadPesoC1, @Peso;

        IF COL_LENGTH('OrderItemSchedules', 'Remarks') IS NOT NULL
            EXEC sys.sp_executesql N'
                UPDATE OrderItemSchedules
                SET Remarks = REPLACE(REPLACE(REPLACE(REPLACE(Remarks,
                    @BadGift, @Gift), @BadGiftC1, @Gift), @BadPeso, @Peso), @BadPesoC1, @Peso)
                WHERE Remarks LIKE N''%'' + @BadGift + N''%''
                   OR Remarks LIKE N''%'' + @BadGiftC1 + N''%''
                   OR Remarks LIKE N''%'' + @BadPeso + N''%''
                   OR Remarks LIKE N''%'' + @BadPesoC1 + N''%'';',
                N'@BadGift nvarchar(8), @BadGiftC1 nvarchar(8), @Gift nvarchar(8), @BadPeso nvarchar(8), @BadPesoC1 nvarchar(8), @Peso nvarchar(8)',
                @BadGift, @BadGiftC1, @Gift, @BadPeso, @BadPesoC1, @Peso;
    ");

    // Non-destructive ledger reconciliation: preserve advance downpayment records
    // without inflating cached Downpayment from final Hop 2 settlement collections.
    await context.Database.ExecuteSqlRawAsync(@"
        ;WITH LedgerTotals AS (
            SELECT OrderId, SUM(Amount) AS TotalPaid
            FROM PaymentLogs
            WHERE Status = 1 AND ISNULL(IsVoided, 0) = 0
              AND GatewayReferenceId NOT LIKE 'OWNER_%'
              AND GatewayReferenceId NOT LIKE 'QR_SETTLE_%'
              AND GatewayReferenceId NOT LIKE '%_ORDER_%'
            GROUP BY OrderId
        )
        INSERT INTO OrderAuditLogs
            (OrderId, ActionType, Changes, ChangedBy, Timestamp, CreatedAt, UpdatedAt)
        SELECT o.Id,
               N'Payment Ledger Reconciled',
               CONCAT(N'[Payment Ledger Reconciled] Active advance payment records total ₱',
                      CONVERT(varchar(32), CAST(lt.TotalPaid AS decimal(18,2))),
                      N'; previous cached total was ₱',
                      CONVERT(varchar(32), CAST(o.Downpayment AS decimal(18,2))), N'.'),
               N'System Startup Repair',
               GETUTCDATE(),
               GETUTCDATE(),
               NULL
        FROM Orders o
        INNER JOIN LedgerTotals lt ON lt.OrderId = o.Id
        WHERE lt.TotalPaid > o.Downpayment;

        ;WITH LedgerTotals AS (
            SELECT OrderId, SUM(Amount) AS TotalPaid
            FROM PaymentLogs
            WHERE Status = 1 AND ISNULL(IsVoided, 0) = 0
              AND GatewayReferenceId NOT LIKE 'OWNER_%'
              AND GatewayReferenceId NOT LIKE 'QR_SETTLE_%'
              AND GatewayReferenceId NOT LIKE '%_ORDER_%'
            GROUP BY OrderId
        )
        UPDATE o
        SET o.Downpayment = lt.TotalPaid,
            o.UpdatedAt = GETUTCDATE()
        FROM Orders o
        INNER JOIN LedgerTotals lt ON lt.OrderId = o.Id
        WHERE lt.TotalPaid > o.Downpayment;

        ;WITH LedgerTotals AS (
            SELECT OrderId, SUM(Amount) AS TotalPaid
            FROM PaymentLogs
            WHERE Status = 1 AND ISNULL(IsVoided, 0) = 0
            GROUP BY OrderId
        )
        UPDATE o
        SET o.SettlementCustodyStatus = N'Uncollected',
            o.HeldByStaffMethod = NULL,
            o.HeldByStaffAmount = 0,
            o.StaffValidatedBy = NULL,
            o.StaffValidatedAt = NULL,
            o.UpdatedAt = GETUTCDATE()
        FROM Orders o
        INNER JOIN LedgerTotals lt ON lt.OrderId = o.Id
        WHERE o.SettlementCustodyStatus = N'InStaffDrawer'
          AND ISNULL(o.HeldByStaffAmount, 0) = 0
          AND ISNULL(o.DigitalTransferAmount, 0) = 0
          AND o.TargetDeliveryTime >= CAST(GETDATE() AS date)
          AND lt.TotalPaid < o.GrandTotal;
    ");

    // Non-destructive DP repair: restore advance booking downpayment (₱2,200) for Robin Evangelio #111326-901 if mutated by final pickup settlement
    await context.Database.ExecuteSqlRawAsync(@"
        UPDATE Orders
        SET Downpayment = 2200.00,
            UpdatedAt = GETUTCDATE()
        WHERE OrderReference IN ('111326-901', '#111326-901')
          AND Downpayment > 2200.00;
    ");

    await context.Database.ExecuteSqlRawAsync(@"
        UPDATE oi
        SET oi.Price = ic.BasePrice,
            oi.TotalPrice = ic.BasePrice * oi.Quantity
        FROM OrderItems oi
        INNER JOIN ItemCategories ic ON oi.ItemCategoryId = ic.Id
        INNER JOIN Orders o ON oi.OrderId = o.Id
        WHERE oi.Price = 0 AND o.IsCancelled = 0 AND o.TargetDeliveryTime >= CAST(GETDATE() AS DATE);
    ");

    var retiredTestRiderNames = new[] { "Kuya AL", "Kuya Berto", "Kuya Jun" };
    await context.Riders
        .Where(rider => retiredTestRiderNames.Contains(rider.FullName) && rider.IsActive)
        .ExecuteUpdateAsync(updates => updates.SetProperty(rider => rider.IsActive, false));

    await context.Riders
        .Where(rider => rider.FullName.ToLower() == "bdo" && rider.IsActive)
        .ExecuteUpdateAsync(updates => updates.SetProperty(rider => rider.IsActive, false));

    // Safe Data Self-Heal: Auto-heal any orders accidentally saved with Year < 2025 (e.g. 2016 typo like Jenah M. Chavez)
    await context.Database.ExecuteSqlRawAsync(@"
        UPDATE Orders
        SET TargetDeliveryTime = DATEADD(year, 2026 - YEAR(TargetDeliveryTime), TargetDeliveryTime)
        WHERE TargetDeliveryTime IS NOT NULL AND YEAR(TargetDeliveryTime) < 2025 AND IsCancelled = 0 AND IsDraft = 0;

        UPDATE Orders
        SET RiderDepartureTime = DATEADD(year, 2026 - YEAR(RiderDepartureTime), RiderDepartureTime)
        WHERE RiderDepartureTime IS NOT NULL AND YEAR(RiderDepartureTime) < 2025 AND IsCancelled = 0 AND IsDraft = 0;
    ");

    // Repair future wall-clock schedules that carry the telltale +8-hour drift.
    // This updates timestamps only; no schedule, order, or customer record is removed.
    var scheduleRepairOrders = await context.Orders
        .Include(order => order.OrderItems)
        .Where(order => !order.IsCancelled && !order.IsDraft &&
                        order.TargetDeliveryTime.HasValue &&
                        order.TargetDeliveryTime.Value >= PhilippineTime.Today)
        .ToListAsync();
    var cookingProfiles = await context.ProductCookingProfiles
        .AsNoTracking()
        .ToDictionaryAsync(profile => profile.ItemCategoryId);
    var scheduleRepairChanges = 0;

    foreach (var order in scheduleRepairOrders)
    {
        var target = DateTime.SpecifyKind(order.TargetDeliveryTime!.Value, DateTimeKind.Unspecified);
        var isPickupOrCourier = order.Fulfillment == FulfillmentType.Pickup ||
                                order.Fulfillment == FulfillmentType.Lalamove;
        var existingDeparture = order.RiderDepartureTime.HasValue
            ? DateTime.SpecifyKind(order.RiderDepartureTime.Value, DateTimeKind.Unspecified)
            : (DateTime?)null;
        var departureWasCorrupt = !existingDeparture.HasValue ||
                                  existingDeparture.Value > target ||
                                  existingDeparture.Value < target.AddDays(-1);
        var departure = !departureWasCorrupt
            ? existingDeparture!.Value
            : isPickupOrCourier
                ? target
                : target.AddHours(-1);
        departure = DateTime.SpecifyKind(departure, DateTimeKind.Unspecified);
        var departureChanged = order.RiderDepartureTime != departure;
        order.RiderDepartureTime = departure;
        if (departureChanged) scheduleRepairChanges++;

        var orderItemIds = order.OrderItems.Select(item => item.Id).ToList();
        var schedules = await context.OrderItemSchedules
            .Where(schedule => orderItemIds.Contains(schedule.OrderItemId))
            .ToListAsync();
        var repairedThisOrder = false;

        foreach (var schedule in schedules)
        {
            var hasImpossibleAfternoonDrift = target.Hour > 5 &&
                (schedule.TahiStartTime.TimeOfDay > target.TimeOfDay ||
                 schedule.SalangStartTime.TimeOfDay > target.TimeOfDay ||
                 schedule.PackagingStartTime.TimeOfDay > target.TimeOfDay);
            var item = order.OrderItems.First(orderItem => orderItem.Id == schedule.OrderItemId);
            var categoryId = item.FulfilledItemCategoryId ?? item.ItemCategoryId;
            cookingProfiles.TryGetValue(categoryId, out var profile);
            var packagingMinutes = profile?.PackagingDurationMinutes ?? 30;
            var salangMinutes = profile?.SalangDurationMinutes ?? 180;
            var tahiMinutes = profile?.TahiDurationMinutes ?? 60;
            var isNotDepartureAnchored = !schedule.IsManualOverride &&
                schedule.PackagingStartTime != departure.AddMinutes(-packagingMinutes);
            if (!departureWasCorrupt && !hasImpossibleAfternoonDrift && !isNotDepartureAnchored) continue;
            if (schedule.IsManualOverride && !hasImpossibleAfternoonDrift) continue;

            schedule.TargetDeliveryTime = target;
            schedule.PackagingStartTime = departure.AddMinutes(-packagingMinutes);
            schedule.SalangStartTime = schedule.PackagingStartTime.AddMinutes(-salangMinutes);
            schedule.TahiStartTime = schedule.SalangStartTime.AddMinutes(-tahiMinutes);
            schedule.IsManualOverride = false;
            repairedThisOrder = true;
            scheduleRepairChanges++;
        }

        if (repairedThisOrder || departureChanged)
        {
            context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Schedule Timezone Repair",
                Changes = $"Corrected +8-hour schedule drift using Philippine local wall-clock time. Departure anchored to {departure:MMM dd, yyyy h:mm tt}.",
                ChangedBy = "System Startup Repair",
                Timestamp = DateTime.UtcNow
            });
        }
    }

    if (scheduleRepairChanges > 0)
    {
        await context.SaveChangesAsync();
    }

    // QA data can remove/recreate scenario orders. It must be explicitly opted in
    // so ordinary local API restarts never mutate or purge operational records.
    if (app.Environment.IsDevelopment() &&
        builder.Configuration.GetValue<bool>("EnableQaDataSeeder"))
    {
        await QaDataSeeder.SeedQaDataAsync(scope.ServiceProvider);
    }
}

// ==========================================
// PHASE 2: THE REQUEST PIPELINE (MIDDLEWARE)
// All 'app.Use...' statements stay down here!
// ==========================================

app.MapOpenApi();
app.UseSwagger();
app.UseSwaggerUI();

// 🟢 Use CORS right before mapping routes
app.UseCors("AllowReactApp"); 
app.UseAuthentication();
app.Use(async (httpContext, next) =>
{
    // Public QR logistics routes intentionally remain usable by unauthenticated
    // riders. An authenticated Accountant, however, is explicitly isolated from
    // every operational/revenue route even when an action is otherwise anonymous.
    if (httpContext.User.Identity?.IsAuthenticated == true &&
        httpContext.User.IsInRole("Accountant"))
    {
        var path = httpContext.Request.Path;
        var isExpenseSummaryAlias = path.Equals("/api/reports/expenses-summary", StringComparison.OrdinalIgnoreCase);
        var isBlocked = path.StartsWithSegments("/api/orders") ||
                        path.StartsWithSegments("/api/schedules") ||
                        path.StartsWithSegments("/api/logistics") ||
                        path.StartsWithSegments("/api/dashboard") ||
                        path.StartsWithSegments("/api/analytics") ||
                        (path.StartsWithSegments("/api/reports") && !isExpenseSummaryAlias);
        if (isBlocked)
        {
            httpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
            httpContext.Response.ContentType = "application/json";
            await httpContext.Response.WriteAsync("{\"message\":\"Accountant accounts are restricted to the expense ledger.\"}");
            return;
        }
    }

    await next();
});
app.UseAuthorization();
app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
