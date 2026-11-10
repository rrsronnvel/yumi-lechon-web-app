-- ============================================================================
-- Yumi Lechon Management System: Non-Destructive QA Seeding Script
-- Operational Date: November 10, 2026 (2026-11-10)
-- Target Entities:
--   1. #111026-901: Jane Palay (Lalamove Anchor QA, 10:30 AM pickup vs 12:00 PM delivery, 1x M)
--   2. #111026-902: Sam Sam (Belly Coke Swap QA, 1x Belly 5kg with 4x Coke swap + 1x Palabok paid add-on)
--   3. #111026-903: Richard Hernandez (Less 2k QA, 1x L with Less ₱2k discount & 1x Sarsa only, Rider AL)
--   4. #111026-904: Badeth Beltran (Raw Innards QA, 1x XS Store Pickup with Raw Innards / Hilaw)
--   5. KitchenPrepRequests:
--      - Paluto #1: Staff Meryenda (2x Pancit, 3x Puto, 2x 1.5L Coke at 03:00 PM)
--      - Paluto #2: Owner Lunch (2x Dinuguan, 2x Puto, 1x Sarsa at 11:30 AM)
-- 
-- SAFETY MANDATE:
--   Idempotent and non-destructive. Cleans only test references (-901, -902, -903, -904)
--   and specific test Paluto requests. Preserves 100% of existing baseline customer orders.
-- ============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- ============================================================================
-- Step 1: Idempotently clean up only specific test references (-901, -902, -903, -904)
-- ============================================================================
DELETE FROM [dbo].[OrderItemSchedules] 
WHERE [OrderItemId] IN (
    SELECT oi.[Id] 
    FROM [dbo].[OrderItems] oi 
    JOIN [dbo].[Orders] o ON oi.[OrderId] = o.[Id]
    WHERE o.[OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904', 
                                '#111026-901', '#111026-902', '#111026-903', '#111026-904')
);

DELETE FROM [dbo].[SettlementQrSessions]
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904', 
                                '#111026-901', '#111026-902', '#111026-903', '#111026-904')
);

DELETE FROM [dbo].[InventoryReservations]
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904', 
                                '#111026-901', '#111026-902', '#111026-903', '#111026-904')
);

DELETE FROM [dbo].[PaymentLogs] 
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904', 
                                '#111026-901', '#111026-902', '#111026-903', '#111026-904')
);

DELETE FROM [dbo].[OrderAuditLogs] 
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904', 
                                '#111026-901', '#111026-902', '#111026-903', '#111026-904')
);

DELETE FROM [dbo].[OrderItems] 
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904', 
                                '#111026-901', '#111026-902', '#111026-903', '#111026-904')
);

DELETE FROM [dbo].[Orders] 
WHERE [OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904', 
                            '#111026-901', '#111026-902', '#111026-903', '#111026-904');

DELETE FROM [dbo].[KitchenPrepRequests] 
WHERE [RecipientOrLabel] IN (N'Kitchen & Riders Meryenda', 
                             N'Kitchen & Riders Afternoon Meryenda', 
                             N'Boss Lunch at Commissary')
  AND CAST([TargetDate] AS DATE) = '2026-11-10';

-- ============================================================================
-- Step 2: Ensure DeliveryTrip for Rider AL exists for 2026-11-10
-- ============================================================================
DECLARE @TripAlId INT;
SELECT TOP 1 @TripAlId = [Id] FROM [dbo].[DeliveryTrips] 
WHERE [RiderName] = N'AL' AND CAST([DispatchTime] AS DATE) = '2026-11-10';

IF @TripAlId IS NULL
BEGIN
    INSERT INTO [dbo].[DeliveryTrips] (
        [RiderName], 
        [VehicleType], 
        [Status], 
        [DispatchTime], 
        [CreatedAt], 
        [UpdatedAt]
    ) VALUES (
        N'AL', 
        N'Motorcycle', 
        1, -- Active / In Transit
        '2026-11-10 16:00:00', 
        GETUTCDATE(), 
        GETUTCDATE()
    );
    SET @TripAlId = SCOPE_IDENTITY();
END

-- ============================================================================
-- Step 3: Insert Order #111026-901 (Jane Palay, Lalamove, 10:30 Pickup vs 12:00 Lunch, 1x M)
-- ============================================================================
DECLARE @Order901Id INT;
DECLARE @Item901Id INT;

INSERT INTO [dbo].[Orders] (
    [OrderReference],
    [CustomerName],
    [FacebookName],
    [ContactNumber],
    [Source],
    [EventType],
    [Fulfillment],
    [RoutingStatus],
    [DeliveryAddress],
    [Remarks],
    [Price],
    [Discount],
    [DeliveryFee],
    [Downpayment],
    [DownpaymentMethod],
    [GrandTotal],
    [FreebiesSummary],
    [FreebiesConfigJson],
    [IsTrustedCustomer],
    [TargetDeliveryTime],
    [RiderDepartureTime],
    [IsDeliveryDetailsConfirmed],
    [IsCancelled],
    [IsPriceWaived],
    [IsDraft],
    [IsTimeTbd],
    [IsOwnerConfirmed],
    [OwnerConfirmedAt],
    [OwnerConfirmedBy],
    [CreatedBy],
    [CreatedAt],
    [SettlementCustodyStatus]
) VALUES (
    N'111026-901',
    N'Jane Palay (Lalamove Anchor QA)',
    N'Jane Palay',
    N'09455871812',
    N'Messenger',
    N'Birthday Celebration',
    2, -- Lalamove
    0, -- Unassigned
    N'Phase 2 Blk 42 Lot 43 Terraverde Residences, Carmona, Cavite',
    N'Lalamove driver pickup at 10:30 AM sharp; customer expected serving at 12:00 PM',
    12700.00,
    0.00,
    0.00,
    2700.00,
    N'GCash',
    12700.00,
    N'🎁 7 Freebies',
    N'{"optOut":false,"rawInnards":false,"pigsWithFreebies":1,"counts":{"Sarsa":1,"1.5L Coke":1,"Pancit":1,"Palabok":1,"Spaghetti":1,"Dinuguan":1,"Puto":1}}',
    0,
    '2026-11-10 12:00:00',
    '2026-11-10 10:30:00',
    1,
    0,
    0,
    0,
    0,
    1,
    '2026-11-09 10:00:00',
    N'Business Owner (@owner)',
    N'Business Owner (@owner)',
    '2026-11-09 10:00:00',
    N'Uncollected'
);

SET @Order901Id = SCOPE_IDENTITY();

-- Insert 1x Medium Lechon (ItemCategoryId = 4, BasePrice = 12,700)
INSERT INTO [dbo].[OrderItems] (
    [OrderId],
    [ItemCategoryId],
    [Quantity],
    [Price],
    [TotalPrice],
    [CreatedAt]
) VALUES (
    @Order901Id,
    4, -- M
    1,
    12700.00,
    12700.00,
    '2026-11-09 10:00:00'
);

SET @Item901Id = SCOPE_IDENTITY();

-- Insert OrderItemSchedule for #111026-901 anchored strictly to 10:30 AM Pickup
-- Salang at 07:30 AM, Tahi at 06:30 AM, Packaging at 10:00 AM, Target Delivery 12:00 PM
INSERT INTO [dbo].[OrderItemSchedules] (
    [OrderItemId],
    [TargetDeliveryTime],
    [PackagingStartTime],
    [SalangStartTime],
    [TahiStartTime],
    [IsManualOverride],
    [CurrentStatus],
    [CreatedAt]
) VALUES (
    @Item901Id,
    '2026-11-10 12:00:00',
    '2026-11-10 10:00:00',
    '2026-11-10 07:30:00',
    '2026-11-10 06:30:00',
    0,
    0, -- Defrosting / Active
    '2026-11-09 10:00:00'
);

-- PaymentLog for Order #111026-901
INSERT INTO [dbo].[PaymentLogs] (
    [OrderId],
    [GatewayReferenceId],
    [Provider],
    [Amount],
    [Status],
    [PaymentMethod],
    [IsVoided],
    [CreatedAt],
    [UpdatedAt]
) VALUES (
    @Order901Id,
    N'GCASH-DP-111026901',
    1, -- GCash
    2700.00,
    1, -- Completed
    N'GCash',
    0,
    '2026-11-09 10:00:00',
    '2026-11-09 10:00:00'
);

-- ============================================================================
-- Step 4: Insert Order #111026-902 (Sam Sam, Belly 5kg + 4x Coke Swap + Paid Palabok Add-On)
-- ============================================================================
DECLARE @Order902Id INT;
DECLARE @Item902BellyId INT;

INSERT INTO [dbo].[Orders] (
    [OrderReference],
    [CustomerName],
    [FacebookName],
    [ContactNumber],
    [Source],
    [EventType],
    [Fulfillment],
    [RoutingStatus],
    [DeliveryAddress],
    [Remarks],
    [AddOns],
    [Price],
    [Discount],
    [DeliveryFee],
    [Downpayment],
    [DownpaymentMethod],
    [GrandTotal],
    [FreebiesSummary],
    [FreebiesConfigJson],
    [IsTrustedCustomer],
    [TargetDeliveryTime],
    [RiderDepartureTime],
    [IsDeliveryDetailsConfirmed],
    [IsCancelled],
    [IsPriceWaived],
    [IsDraft],
    [IsTimeTbd],
    [IsOwnerConfirmed],
    [OwnerConfirmedAt],
    [OwnerConfirmedBy],
    [CreatedBy],
    [CreatedAt],
    [SettlementCustodyStatus]
) VALUES (
    N'111026-902',
    N'Sam Sam (Belly Coke Swap QA)',
    N'Sam Sam',
    N'09776816227',
    N'Messenger',
    N'Family Lunch',
    2, -- Lalamove Courier
    0, -- Unassigned
    N'JB Private Resort, Blk 41 Lot 43 Barletta St., Bella Vista Subd., Gen. Trias, Cavite',
    N'Lalamove pickup at 10:30 AM; Bilao swapped for 4x 1.5L Coke plus paid Palabok add-on',
    N'+ 1x Palabok',
    4200.00,
    0.00,
    0.00,
    1000.00,
    N'GCash',
    4650.00, -- 4200 Belly + 450 Palabok
    N'🎁 Belly Freebies: 1x Sarsa, 4x 1.5L Coke (Bilao Swapped)',
    N'{"optOut":false,"rawInnards":false,"counts":{"Sarsa":0,"1.5L Coke":0,"Pancit":0,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0},"bellyCounts":{"Sarsa":1,"1.5L Coke":4,"Pancit":0,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0},"bellyCustomizationNote":"4x 1.5L Coke swap"}',
    0,
    '2026-11-10 11:30:00',
    '2026-11-10 10:30:00',
    1,
    0,
    0,
    0,
    0,
    1,
    '2026-11-09 11:00:00',
    N'Business Owner (@owner)',
    N'Business Owner (@owner)',
    '2026-11-09 11:00:00',
    N'Uncollected'
);

SET @Order902Id = SCOPE_IDENTITY();

-- Insert 1x Belly 5kg (ItemCategoryId = 13, BasePrice = 4,200)
INSERT INTO [dbo].[OrderItems] (
    [OrderId],
    [ItemCategoryId],
    [Quantity],
    [Price],
    [TotalPrice],
    [CreatedAt]
) VALUES (
    @Order902Id,
    13, -- Belly 5kg
    1,
    4200.00,
    4200.00,
    '2026-11-09 11:00:00'
);

SET @Item902BellyId = SCOPE_IDENTITY();

-- Insert 1x Palabok Paid Add-On (ItemCategoryId = 17, Price = 450.00)
INSERT INTO [dbo].[OrderItems] (
    [OrderId],
    [ItemCategoryId],
    [Quantity],
    [Price],
    [TotalPrice],
    [CreatedAt]
) VALUES (
    @Order902Id,
    17, -- Palabok
    1,
    450.00,
    450.00,
    '2026-11-09 11:00:00'
);

-- Insert OrderItemSchedule for Belly 5kg anchored to 10:30 AM departure
INSERT INTO [dbo].[OrderItemSchedules] (
    [OrderItemId],
    [TargetDeliveryTime],
    [PackagingStartTime],
    [SalangStartTime],
    [TahiStartTime],
    [IsManualOverride],
    [CurrentStatus],
    [CreatedAt]
) VALUES (
    @Item902BellyId,
    '2026-11-10 11:30:00',
    '2026-11-10 10:15:00',
    '2026-11-10 08:00:00',
    '2026-11-10 07:30:00',
    0,
    0,
    '2026-11-09 11:00:00'
);

-- PaymentLog for Order #111026-902
INSERT INTO [dbo].[PaymentLogs] (
    [OrderId],
    [GatewayReferenceId],
    [Provider],
    [Amount],
    [Status],
    [PaymentMethod],
    [IsVoided],
    [CreatedAt],
    [UpdatedAt]
) VALUES (
    @Order902Id,
    N'GCASH-DP-111026902',
    1, -- GCash
    1000.00,
    1, -- Completed
    N'GCash',
    0,
    '2026-11-09 11:00:00',
    '2026-11-09 11:00:00'
);

-- ============================================================================
-- Step 5: Insert Order #111026-903 (Richard Hernandez, Less 2k QA, 1x L, Rider AL)
-- ============================================================================
DECLARE @Order903Id INT;
DECLARE @Item903Id INT;

INSERT INTO [dbo].[Orders] (
    [OrderReference],
    [CustomerName],
    [FacebookName],
    [ContactNumber],
    [Source],
    [EventType],
    [Fulfillment],
    [RoutingStatus],
    [DeliveryTripId],
    [DeliveryAddress],
    [Remarks],
    [Price],
    [Discount],
    [DeliveryFee],
    [Downpayment],
    [DownpaymentMethod],
    [GrandTotal],
    [FreebiesSummary],
    [FreebiesConfigJson],
    [IsTrustedCustomer],
    [TargetDeliveryTime],
    [RiderDepartureTime],
    [IsDeliveryDetailsConfirmed],
    [IsCancelled],
    [IsPriceWaived],
    [IsDraft],
    [IsTimeTbd],
    [IsOwnerConfirmed],
    [OwnerConfirmedAt],
    [OwnerConfirmedBy],
    [CreatedBy],
    [CreatedAt],
    [SettlementCustodyStatus]
) VALUES (
    N'111026-903',
    N'Richard Hernandez (Less 2k QA)',
    N'Richard Hernandez',
    N'09773321618',
    N'Messenger',
    N'Family Reunion',
    1, -- Freelance Delivery
    1, -- Assigned
    @TripAlId,
    N'8232 konsehales st. Brgy.8 Carmona Cavite',
    N'Less 2k promo applied - opted out of 7 freebies; strictly 1x liver sauce only, no free bilao',
    13500.00,
    2000.00,
    0.00,
    5000.00,
    N'GCash',
    11500.00, -- 13500 - 2000 discount
    N'🚫 No Freebies (Less ₱2,000 Promo - 1x Liver Sauce Only)',
    N'{"optOut":true,"rawInnards":false,"pigsWithFreebies":0,"mode":"none","counts":{"Sarsa":1,"1.5L Coke":0,"Pancit":0,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0}}',
    0,
    '2026-11-10 17:00:00',
    '2026-11-10 16:00:00',
    1,
    0,
    0,
    0,
    0,
    1,
    '2026-11-09 12:00:00',
    N'Business Owner (@owner)',
    N'Business Owner (@owner)',
    '2026-11-09 12:00:00',
    N'Uncollected'
);

SET @Order903Id = SCOPE_IDENTITY();

-- Insert 1x Large Lechon (ItemCategoryId = 5, BasePrice = 13,500)
INSERT INTO [dbo].[OrderItems] (
    [OrderId],
    [ItemCategoryId],
    [Quantity],
    [Price],
    [TotalPrice],
    [CreatedAt]
) VALUES (
    @Order903Id,
    5, -- L
    1,
    13500.00,
    13500.00,
    '2026-11-09 12:00:00'
);

SET @Item903Id = SCOPE_IDENTITY();

-- Insert OrderItemSchedule for #111026-903 anchored to 16:00 Departure
-- Packaging: 15:30, Salang: 12:30 (180m), Tahi: 11:30 (60m)
INSERT INTO [dbo].[OrderItemSchedules] (
    [OrderItemId],
    [TargetDeliveryTime],
    [PackagingStartTime],
    [SalangStartTime],
    [TahiStartTime],
    [IsManualOverride],
    [CurrentStatus],
    [CreatedAt]
) VALUES (
    @Item903Id,
    '2026-11-10 17:00:00',
    '2026-11-10 15:30:00',
    '2026-11-10 12:30:00',
    '2026-11-10 11:30:00',
    0,
    0,
    '2026-11-09 12:00:00'
);

-- PaymentLog for Order #111026-903
INSERT INTO [dbo].[PaymentLogs] (
    [OrderId],
    [GatewayReferenceId],
    [Provider],
    [Amount],
    [Status],
    [PaymentMethod],
    [IsVoided],
    [CreatedAt],
    [UpdatedAt]
) VALUES (
    @Order903Id,
    N'GCASH-DP-111026903',
    1, -- GCash
    5000.00,
    1, -- Completed
    N'GCash',
    0,
    '2026-11-09 12:00:00',
    '2026-11-09 12:00:00'
);

-- ============================================================================
-- Step 6: Insert Order #111026-904 (Badeth Beltran, Raw Innards QA, 1x XS Store Pickup)
-- ============================================================================
DECLARE @Order904Id INT;
DECLARE @Item904Id INT;

INSERT INTO [dbo].[Orders] (
    [OrderReference],
    [CustomerName],
    [FacebookName],
    [ContactNumber],
    [Source],
    [EventType],
    [Fulfillment],
    [RoutingStatus],
    [DeliveryAddress],
    [Remarks],
    [Price],
    [Discount],
    [DeliveryFee],
    [Downpayment],
    [DownpaymentMethod],
    [GrandTotal],
    [FreebiesSummary],
    [FreebiesConfigJson],
    [IsTrustedCustomer],
    [TargetDeliveryTime],
    [RiderDepartureTime],
    [IsDeliveryDetailsConfirmed],
    [IsCancelled],
    [IsPriceWaived],
    [IsDraft],
    [IsTimeTbd],
    [IsOwnerConfirmed],
    [OwnerConfirmedAt],
    [OwnerConfirmedBy],
    [CreatedBy],
    [CreatedAt],
    [SettlementCustodyStatus]
) VALUES (
    N'111026-904',
    N'Badeth Beltran (Raw Innards QA)',
    N'Badeth Beltran',
    N'09170000004',
    N'Messenger',
    N'Thanksgiving Party',
    0, -- Store Pickup
    0, -- Unassigned
    N'Store Counter (Pickup)',
    N'Customer requested raw innards (hilaw - walang dinuguan)',
    11000.00,
    0.00,
    0.00,
    2000.00,
    N'Cash',
    11000.00,
    N'🎁 7 Freebies (🥩 Raw Innards / Hilaw)',
    N'{"optOut":false,"rawInnards":true,"pigsWithFreebies":1,"counts":{"Sarsa":1,"1.5L Coke":1,"Pancit":1,"Palabok":1,"Spaghetti":1,"Dinuguan":0,"Puto":1}}',
    0,
    '2026-11-10 09:30:00',
    '2026-11-10 09:30:00',
    1,
    0,
    0,
    0,
    0,
    1,
    '2026-11-09 13:00:00',
    N'Business Owner (@owner)',
    N'Business Owner (@owner)',
    '2026-11-09 13:00:00',
    N'Uncollected'
);

SET @Order904Id = SCOPE_IDENTITY();

-- Insert 1x XS Lechon (ItemCategoryId = 2, BasePrice = 11,000)
INSERT INTO [dbo].[OrderItems] (
    [OrderId],
    [ItemCategoryId],
    [Quantity],
    [Price],
    [TotalPrice],
    [CreatedAt]
) VALUES (
    @Order904Id,
    2, -- XS
    1,
    11000.00,
    11000.00,
    '2026-11-09 13:00:00'
);

SET @Item904Id = SCOPE_IDENTITY();

-- Insert OrderItemSchedule for #111026-904 anchored to 09:30 Pickup
-- Packaging: 09:00, Salang: 06:30 (150m), Tahi: 05:30 (60m)
INSERT INTO [dbo].[OrderItemSchedules] (
    [OrderItemId],
    [TargetDeliveryTime],
    [PackagingStartTime],
    [SalangStartTime],
    [TahiStartTime],
    [IsManualOverride],
    [CurrentStatus],
    [CreatedAt]
) VALUES (
    @Item904Id,
    '2026-11-10 09:30:00',
    '2026-11-10 09:00:00',
    '2026-11-10 06:30:00',
    '2026-11-10 05:30:00',
    0,
    0,
    '2026-11-09 13:00:00'
);

-- PaymentLog for Order #111026-904
INSERT INTO [dbo].[PaymentLogs] (
    [OrderId],
    [GatewayReferenceId],
    [Provider],
    [Amount],
    [Status],
    [PaymentMethod],
    [IsVoided],
    [CreatedAt],
    [UpdatedAt]
) VALUES (
    @Order904Id,
    N'CASH-DP-111026904',
    0, -- Cash
    2000.00,
    1, -- Completed
    N'Cash',
    0,
    '2026-11-09 13:00:00',
    '2026-11-09 13:00:00'
);

-- ============================================================================
-- Step 7: Insert Store Paluto Entries (KitchenPrepRequests) for 2026-11-10
-- ============================================================================
-- Paluto #1: Staff Meryenda (3:00 PM)
INSERT INTO [dbo].[KitchenPrepRequests] (
    [TargetDate],
    [TargetTime],
    [Category],
    [RecipientOrLabel],
    [ItemsJson],
    [Remarks],
    [CreatedBy],
    [CreatedAt]
) VALUES (
    '2026-11-10 00:00:00',
    '2026-11-10 15:00:00',
    N'Staff Meryenda',
    N'Kitchen & Riders Afternoon Meryenda',
    N'{"Pancit": 2, "Puto": 3, "1.5L Coke": 2}',
    N'Meryenda time ng crew at riders',
    N'Owner',
    GETUTCDATE()
);

-- Paluto #2: Owner Lunch (11:30 AM)
INSERT INTO [dbo].[KitchenPrepRequests] (
    [TargetDate],
    [TargetTime],
    [Category],
    [RecipientOrLabel],
    [ItemsJson],
    [Remarks],
    [CreatedBy],
    [CreatedAt]
) VALUES (
    '2026-11-10 00:00:00',
    '2026-11-10 11:30:00',
    N'Owner / Family',
    N'Boss Lunch at Commissary',
    N'{"Dinuguan": 2, "Puto": 2, "Sarsa": 1}',
    N'Ihanda sa counter para kay Boss',
    N'Owner',
    GETUTCDATE()
);

COMMIT TRANSACTION;

-- ============================================================================
-- Step 8: Verification Summary Output
-- ============================================================================
SELECT 
    o.[Id] AS OrderId,
    o.[OrderReference],
    o.[CustomerName],
    CASE o.[Fulfillment] WHEN 0 THEN 'Pickup' WHEN 1 THEN 'Delivery' WHEN 2 THEN 'Lalamove' END AS Fulfillment,
    dt.[RiderName] AS AssignedRider,
    o.[TargetDeliveryTime],
    o.[RiderDepartureTime],
    o.[GrandTotal],
    o.[Downpayment],
    (o.[GrandTotal] - o.[Downpayment]) AS BalanceDue,
    o.[SettlementCustodyStatus],
    o.[FreebiesSummary]
FROM [dbo].[Orders] o
LEFT JOIN [dbo].[DeliveryTrips] dt ON o.[DeliveryTripId] = dt.[Id]
WHERE o.[OrderReference] IN ('111026-901', '111026-902', '111026-903', '111026-904')
ORDER BY o.[OrderReference];

SELECT 
    [Id] AS PrepRequestId,
    [TargetDate],
    [TargetTime],
    [Category],
    [RecipientOrLabel],
    [ItemsJson],
    [Remarks],
    [CreatedBy]
FROM [dbo].[KitchenPrepRequests]
WHERE CAST([TargetDate] AS DATE) = '2026-11-10'
ORDER BY [TargetTime];

SELECT COUNT(*) AS TotalOrdersInDb FROM [dbo].[Orders];
