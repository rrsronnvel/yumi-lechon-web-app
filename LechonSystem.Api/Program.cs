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
    await context.Database.ExecuteSqlRawAsync(@"
        IF COL_LENGTH('Orders', 'HeldByStaffAmount') IS NULL
            ALTER TABLE Orders ADD HeldByStaffAmount decimal(18,2) NULL;

        IF COL_LENGTH('Orders', 'DigitalTransferMethod') IS NULL
            ALTER TABLE Orders ADD DigitalTransferMethod nvarchar(50) NULL;

        IF COL_LENGTH('Orders', 'DigitalTransferAmount') IS NULL
            ALTER TABLE Orders ADD DigitalTransferAmount decimal(18,2) NULL;

        IF COL_LENGTH('Orders', 'DigitalReferenceNote') IS NULL
            ALTER TABLE Orders ADD DigitalReferenceNote nvarchar(256) NULL;

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

    // Non-destructive ledger reconciliation: preserve every payment record and
    // bring the order's cached paid amount up to the active successful ledger sum.
    await context.Database.ExecuteSqlRawAsync(@"
        ;WITH LedgerTotals AS (
            SELECT OrderId, SUM(Amount) AS TotalPaid
            FROM PaymentLogs
            WHERE Status = 1 AND ISNULL(IsVoided, 0) = 0
            GROUP BY OrderId
        )
        INSERT INTO OrderAuditLogs
            (OrderId, ActionType, Changes, ChangedBy, Timestamp, CreatedAt, UpdatedAt)
        SELECT o.Id,
               N'Payment Ledger Reconciled',
               CONCAT(N'[Payment Ledger Reconciled] Active payment records total ₱',
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
          AND o.TargetDeliveryTime >= CAST(GETDATE() AS date)
          AND lt.TotalPaid < o.GrandTotal;
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
