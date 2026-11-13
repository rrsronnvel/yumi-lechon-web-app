-- ============================================================================
-- Yumi Lechon Management System: Non-Destructive QA Seeding Script
-- Operational Date: November 13, 2026 (2026-11-13)
-- Target Entities:
--   1. #111326-901: Robin Evangelio (Pickup Digital QA, Store Pickup, 5:00 PM, 1x M, DP 2,200 GCash, PendingDigital 10,500 Direct GCash)
--   2. #111326-902: Bunso - Tirador (Shared Phone QA, Store Pickup, 3:00 PM, Phone 09174427367, 1x Belly 2kg, DP 0)
--   3. #111326-903: Johnmark Salipande (Walk-In Cash DP QA, Walk-in, Store Pickup, Nov 15 12:00 PM, Phone 09175551234, 1x L, DP 4,000 Cash, Unremitted)
-- 
-- SAFETY MANDATE:
--   Idempotent and non-destructive. Cleans only test references (-901, -902, -903)
--   Preserves 100% of existing baseline customer orders.
-- ============================================================================

SET NOCOUNT ON;

-- ============================================================================
-- Step 0: Ensure required DDL columns exist (idempotent guards)
-- ============================================================================
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
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- ============================================================================
-- Step 1: Idempotently clean up only specific test references (-901, -902, -903)
-- ============================================================================
DELETE FROM [dbo].[OrderItemSchedules] 
WHERE [OrderItemId] IN (
    SELECT oi.[Id] 
    FROM [dbo].[OrderItems] oi 
    JOIN [dbo].[Orders] o ON oi.[OrderId] = o.[Id]
    WHERE o.[OrderReference] IN ('111326-901', '111326-902', '111326-903', 
                                '#111326-901', '#111326-902', '#111326-903')
);

DELETE FROM [dbo].[SettlementQrSessions]
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111326-901', '111326-902', '111326-903', 
                                '#111326-901', '#111326-902', '#111326-903')
);

DELETE FROM [dbo].[InventoryReservations]
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111326-901', '111326-902', '111326-903', 
                                '#111326-901', '#111326-902', '#111326-903')
);

DELETE FROM [dbo].[PaymentLogs] 
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111326-901', '111326-902', '111326-903', 
                                '#111326-901', '#111326-902', '#111326-903')
);

DELETE FROM [dbo].[OrderAuditLogs] 
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111326-901', '111326-902', '111326-903', 
                                '#111326-901', '#111326-902', '#111326-903')
);

DELETE FROM [dbo].[OrderItems] 
WHERE [OrderId] IN (
    SELECT [Id] FROM [dbo].[Orders] 
    WHERE [OrderReference] IN ('111326-901', '111326-902', '111326-903', 
                                '#111326-901', '#111326-902', '#111326-903')
);

DELETE FROM [dbo].[Orders] 
WHERE [OrderReference] IN ('111326-901', '111326-902', '111326-903', 
                            '#111326-901', '#111326-902', '#111326-903');

-- ============================================================================
-- Step 2: Insert Order #111326-901 (Robin Evangelio, Store Pickup, 1x M, DP 2200, Pending Digital 10500)
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
    [Landmark],
    [Remarks],
    [Price],
    [Discount],
    [DeliveryFee],
    [Downpayment],
    [DownpaymentMethod],
    [IsDpRemittedToOwner],
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
    [SettlementCustodyStatus],
    [HeldByStaffMethod],
    [HeldByStaffAmount],
    [DigitalTransferMethod],
    [DigitalTransferAmount],
    [DigitalReferenceNote],
    [StaffValidatedBy],
    [StaffValidatedAt]
) VALUES (
    N'111326-901',
    N'Robin Evangelio (Pickup Digital QA)',
    N'Robin Evangelio',
    N'09171234567',
    N'Messenger',
    N'Birthday Celebration',
    0, -- Pickup
    0, -- Unassigned
    N'Store Counter Pickup',
    N'Commissary Store Counter',
    N'Store Pickup customer paid remaining balance ₱10,500 via Direct GCash Ref #884411',
    12700.00,
    0.00,
    0.00,
    2200.00,
    N'GCash',
    0, -- IsDpRemittedToOwner: false (unverified digital DP)
    12700.00,
    N'🎁 7 Freebies',
    N'{"optOut":false,"rawInnards":false,"pigsWithFreebies":1,"counts":{"Sarsa":1,"1.5L Coke":1,"Pancit":1,"Palabok":1,"Spaghetti":1,"Dinuguan":1,"Puto":1}}',
    0,
    '2026-11-13 17:00:00',
    '2026-11-13 17:00:00',
    1,
    0,
    0,
    0,
    0,
    1,
    '2026-11-12 10:00:00',
    N'Business Owner (@owner)',
    N'Cashier Staff (@cashier)',
    '2026-11-12 10:00:00',
    N'InStaffDrawer',
    N'Direct GCash',
    0.00,
    N'Direct GCash',
    10500.00,
    N'GCash Ref #884411',
    N'Cashier Staff (@cashier)',
    '2026-11-13 16:30:00'
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
    '2026-11-12 10:00:00'
);

SET @Item901Id = SCOPE_IDENTITY();

-- Insert OrderItemSchedule for #111326-901 anchored to 5:00 PM Pickup
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
    '2026-11-13 17:00:00',
    '2026-11-13 16:30:00',
    '2026-11-13 13:30:00',
    '2026-11-13 12:30:00',
    0,
    0, -- Defrosting
    '2026-11-12 10:00:00'
);

-- PaymentLog for Order #111326-901 (Downpayment)
INSERT INTO [dbo].[PaymentLogs] (
    [OrderId],
    [GatewayReferenceId],
    [Provider],
    [Amount],
    [Status],
    [PaymentMethod],
    [IsVoided],
    [RecordedBy],
    [CreatedAt],
    [UpdatedAt]
) VALUES (
    @Order901Id,
    N'GCASH-DP-111326901',
    1, -- ManualGCash
    2200.00,
    1, -- Success
    N'GCash',
    0,
    N'Cashier Staff (@cashier)',
    '2026-11-12 10:00:00',
    '2026-11-12 10:00:00'
);

-- ============================================================================
-- Step 3: Insert Order #111326-902 (Bunso - Tirador, Shared Phone QA, Belly 2kg, DP 0)
-- ============================================================================
DECLARE @Order902Id INT;
DECLARE @Item902Id INT;

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
    [IsDpRemittedToOwner],
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
    N'111326-902',
    N'Bunso - Tirador (Shared Phone QA)',
    N'Bunso Tirador',
    N'09174427367',
    N'Messenger',
    N'Family Dinner',
    0, -- Pickup
    0, -- Unassigned
    N'Store Counter Pickup',
    N'Shared phone test order with different customer name',
    1700.00,
    0.00,
    0.00,
    0.00,
    N'None',
    0, -- IsDpRemittedToOwner: false
    1700.00,
    N'🎁 Belly Freebies: 1x Sarsa',
    N'{"optOut":false,"rawInnards":false,"counts":{"Sarsa":0,"1.5L Coke":0,"Pancit":0,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0},"bellyCounts":{"Sarsa":1,"1.5L Coke":0,"Pancit":0,"Palabok":0,"Spaghetti":0,"Dinuguan":0,"Puto":0}}',
    0,
    '2026-11-13 15:00:00',
    '2026-11-13 15:00:00',
    1,
    0,
    0,
    0,
    0,
    1,
    '2026-11-12 11:00:00',
    N'Business Owner (@owner)',
    N'Cashier Staff (@cashier)',
    '2026-11-12 11:00:00',
    N'Uncollected'
);

SET @Order902Id = SCOPE_IDENTITY();

-- Insert 1x Belly 2kg (ItemCategoryId = 10, BasePrice = 1,700)
INSERT INTO [dbo].[OrderItems] (
    [OrderId],
    [ItemCategoryId],
    [Quantity],
    [Price],
    [TotalPrice],
    [CreatedAt]
) VALUES (
    @Order902Id,
    10, -- Belly 2kg
    1,
    1700.00,
    1700.00,
    '2026-11-12 11:00:00'
);

SET @Item902Id = SCOPE_IDENTITY();

-- Insert OrderItemSchedule for #111326-902 anchored to 3:00 PM Pickup
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
    @Item902Id,
    '2026-11-13 15:00:00',
    '2026-11-13 14:45:00',
    '2026-11-13 13:15:00',
    '2026-11-13 12:45:00',
    0,
    0,
    '2026-11-12 11:00:00'
);

-- ============================================================================
-- Step 4: Insert Order #111326-903 (Johnmark Salipande, Walk-In Cash DP QA, 1x L, DP 4000, Unremitted)
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
    [DeliveryAddress],
    [Remarks],
    [Price],
    [Discount],
    [DeliveryFee],
    [Downpayment],
    [DownpaymentMethod],
    [IsDpRemittedToOwner],
    [DpRemittedAt],
    [DpRemittedBy],
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
    N'111326-903',
    N'Johnmark Salipande (Walk-In Cash DP QA)',
    N'Johnmark Salipande',
    N'09175551234',
    N'Walk-in',
    N'Anniversary Celebration',
    0, -- Pickup
    0, -- Unassigned
    N'Store Counter Pickup',
    N'Walk-in customer advance booking with cash deposit; awaiting Owner remittance',
    13500.00,
    0.00,
    0.00,
    4000.00,
    N'Cash',
    0, -- IsDpRemittedToOwner: false
    NULL,
    NULL,
    13500.00,
    N'🎁 7 Freebies',
    N'{"optOut":false,"rawInnards":false,"pigsWithFreebies":1,"counts":{"Sarsa":1,"1.5L Coke":1,"Pancit":1,"Palabok":1,"Spaghetti":1,"Dinuguan":1,"Puto":1}}',
    0,
    '2026-11-15 12:00:00',
    '2026-11-15 12:00:00',
    1,
    0,
    0,
    0,
    0,
    1,
    '2026-11-13 09:00:00',
    N'Business Owner (@owner)',
    N'Cashier Staff (@cashier)',
    '2026-11-13 09:00:00',
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
    '2026-11-13 09:00:00'
);

SET @Item903Id = SCOPE_IDENTITY();

-- Insert OrderItemSchedule for #111326-903 anchored to 12:00 PM Pickup on Nov 15
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
    '2026-11-15 12:00:00',
    '2026-11-15 11:30:00',
    '2026-11-15 08:30:00',
    '2026-11-15 07:30:00',
    0,
    0,
    '2026-11-13 09:00:00'
);

-- PaymentLog for Order #111326-903 (Cash Downpayment)
INSERT INTO [dbo].[PaymentLogs] (
    [OrderId],
    [GatewayReferenceId],
    [Provider],
    [Amount],
    [Status],
    [PaymentMethod],
    [IsVoided],
    [RecordedBy],
    [CreatedAt],
    [UpdatedAt]
) VALUES (
    @Order903Id,
    N'CASH-DP-111326903',
    0, -- Cash
    4000.00,
    1, -- Success
    N'Cash',
    0,
    N'Cashier Staff (@cashier)',
    '2026-11-13 09:00:00',
    '2026-11-13 09:00:00'
);

COMMIT TRANSACTION;
PRINT 'QA Data Seeding for 2026-11-13 completed successfully.';

-- ============================================================================
-- Step 5: Verification Summary Output
-- ============================================================================
SELECT 
    o.[Id] AS OrderId,
    o.[OrderReference],
    o.[CustomerName],
    CASE o.[Fulfillment] WHEN 0 THEN 'Pickup' WHEN 1 THEN 'Delivery' WHEN 2 THEN 'Lalamove' END AS Fulfillment,
    o.[TargetDeliveryTime],
    o.[GrandTotal],
    o.[Downpayment],
    (o.[GrandTotal] - o.[Downpayment]) AS BalanceDue,
    o.[SettlementCustodyStatus],
    o.[HeldByStaffAmount],
    o.[DigitalTransferAmount],
    o.[DigitalTransferMethod],
    o.[IsDpRemittedToOwner]
FROM [dbo].[Orders] o
WHERE o.[OrderReference] IN ('111326-901', '111326-902', '111326-903')
ORDER BY o.[OrderReference];

SELECT 
    oi.[OrderId],
    o.[OrderReference],
    ic.[Name] AS CategoryName,
    oi.[Quantity],
    oi.[TotalPrice]
FROM [dbo].[OrderItems] oi
JOIN [dbo].[Orders] o ON oi.[OrderId] = o.[Id]
JOIN [dbo].[ItemCategories] ic ON oi.[ItemCategoryId] = ic.[Id]
WHERE o.[OrderReference] IN ('111326-901', '111326-902', '111326-903')
ORDER BY oi.[OrderId];

SELECT 
    pl.[OrderId],
    o.[OrderReference],
    pl.[PaymentMethod],
    pl.[Amount],
    pl.[Status]
FROM [dbo].[PaymentLogs] pl
JOIN [dbo].[Orders] o ON pl.[OrderId] = o.[Id]
WHERE o.[OrderReference] IN ('111326-901', '111326-902', '111326-903')
ORDER BY pl.[OrderId];

SELECT COUNT(*) AS TotalOrdersInDb FROM [dbo].[Orders];
