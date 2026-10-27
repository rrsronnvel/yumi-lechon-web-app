-- ============================================================================
-- Yumi Lechon Management System: Clean-Room Seed Script (Upcoming Orders)
-- Target Window: October 28, 2026 onwards (69 Orders from 27-10-2026 yumi.xlsx)
-- All-in-one Unicode-safe (N'...') script for Local & SmarterASP Live DB
-- ============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- ----------------------------------------------------------------------------
-- Step 1: Clean-Room Transactional Purge
-- ----------------------------------------------------------------------------
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";

DELETE FROM [dbo].[SettlementQrSessions];
DELETE FROM [dbo].[PaymentLogs];
DELETE FROM [dbo].[OrderAuditLogs];
DELETE FROM [dbo].[OrderItemSchedules];
DELETE FROM [dbo].[OrderItems];
DELETE FROM [dbo].[InventoryReservations];
DELETE FROM [dbo].[InventoryTransactions];
DELETE FROM [dbo].[DeliveryTrips];
DELETE FROM [dbo].[Orders];
DELETE FROM [dbo].[CustomerProfiles];

IF OBJECT_ID('[dbo].[Orders]', 'U') IS NOT NULL DBCC CHECKIDENT ('[dbo].[Orders]', RESEED, 0);
IF OBJECT_ID('[dbo].[OrderItems]', 'U') IS NOT NULL DBCC CHECKIDENT ('[dbo].[OrderItems]', RESEED, 0);
IF OBJECT_ID('[dbo].[OrderItemSchedules]', 'U') IS NOT NULL DBCC CHECKIDENT ('[dbo].[OrderItemSchedules]', RESEED, 0);
IF OBJECT_ID('[dbo].[InventoryReservations]', 'U') IS NOT NULL DBCC CHECKIDENT ('[dbo].[InventoryReservations]', RESEED, 0);
IF OBJECT_ID('[dbo].[PaymentLogs]', 'U') IS NOT NULL DBCC CHECKIDENT ('[dbo].[PaymentLogs]', RESEED, 0);
IF OBJECT_ID('[dbo].[DeliveryTrips]', 'U') IS NOT NULL DBCC CHECKIDENT ('[dbo].[DeliveryTrips]', RESEED, 0);

EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";

-- ----------------------------------------------------------------------------
-- Step 2: Rider Registry Cleanup & Active Sync
-- ----------------------------------------------------------------------------
DELETE FROM [dbo].[Riders] WHERE [FullName] IN (N'Kuya AL', N'Kuya Berto', N'Kuya Jun');

IF NOT EXISTS (SELECT 1 FROM [dbo].[Riders] WHERE [FullName] = N'Robi')
    INSERT INTO [dbo].[Riders] ([FullName], [PhoneNumber], [IsActive], [CreatedAt]) VALUES (N'Robi', N'', 1, '2026-10-27 12:00:00');

IF NOT EXISTS (SELECT 1 FROM [dbo].[Riders] WHERE [FullName] = N'Mj')
    INSERT INTO [dbo].[Riders] ([FullName], [PhoneNumber], [IsActive], [CreatedAt]) VALUES (N'Mj', N'', 1, '2026-10-27 12:00:00');

UPDATE [dbo].[Riders] SET [IsActive] = 1 WHERE [FullName] IN (N'AL', N'Francis', N'Aaron', N'Randy', N'Rhoge', N'Vhenz', N'Macky', N'Ranzel', N'Bhek', N'Adriane', N'Lerry', N'Joener', N'Robi', N'Mj');

-- Ensure Raw Innards (Lamang-Loob) exists in ItemCategories
IF NOT EXISTS (SELECT 1 FROM [dbo].[ItemCategories] WHERE [Name] = N'Raw Innards (Lamang-Loob)')
BEGIN
    SET IDENTITY_INSERT [dbo].[ItemCategories] ON;
    INSERT INTO [dbo].[ItemCategories] ([Id], [Name], [MinimumWeightKg], [MaximumWeightKg], [BasePrice], [MinimumSafetyStock], [IsActive], [CreatedAt])
    VALUES (21, N'Raw Innards (Lamang-Loob)', 0.0, 0.0, 300.00, 0, 1, '2026-10-27 12:00:00');
    SET IDENTITY_INSERT [dbo].[ItemCategories] OFF;
END
ELSE
BEGIN
    UPDATE [dbo].[ItemCategories]
    SET [MinimumWeightKg] = 0.0, [MaximumWeightKg] = 0.0, [BasePrice] = 300.00, [IsActive] = 1
    WHERE [Name] = N'Raw Innards (Lamang-Loob)';
END

-- Baseline physical stock (25 units per roast category)
INSERT INTO [dbo].[InventoryTransactions]
    ([TransactionDate], [ItemCategoryId], [Quantity], [Type], [Reason], [CreatedAt])
SELECT
    '2026-10-27 00:00:00',
    [Id],
    25,
    0, -- StockIn
    N'Production Baseline Stock',
    '2026-10-27 12:00:00'
FROM [dbo].[ItemCategories]
WHERE [MinimumWeightKg] > 0;

-- ----------------------------------------------------------------------------
-- Step 3: Seed DeliveryTrips (Tomorrow's Assigned Riders on 10/28/2026)
-- ----------------------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[DeliveryTrips] ON;
INSERT INTO [dbo].[DeliveryTrips] ([Id], [RiderName], [VehicleType], [Status], [DispatchTime], [CreatedAt]) VALUES
    (1, N'AL', N'Motorcycle', 1, '2026-10-28 09:00:00', '2026-10-27 12:00:00'),
    (2, N'Francis', N'Motorcycle', 1, '2026-10-28 15:45:00', '2026-10-27 12:00:00');
SET IDENTITY_INSERT [dbo].[DeliveryTrips] OFF;

-- ----------------------------------------------------------------------------
-- Step 4: Seed Orders (69 Rows)
-- ----------------------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[Orders] ON;

INSERT INTO [dbo].[Orders] ([Id], [OrderReference], [CustomerName], [FacebookName], [ContactNumber], [Source], [EventType], [IsDraft], [IsTimeTbd], [DeliveryAddress], [Landmark], [Remarks], [Price], [AddOns], [DeliveryFee], [Downpayment], [DownpaymentMethod], [FreebiesSummary], [FreebiesConfigJson], [IsOwnerConfirmed], [OwnerConfirmedAt], [OwnerConfirmedBy], [Discount], [GrandTotal], [IsTrustedCustomer], [TargetDeliveryTime], [RiderDepartureTime], [IsDeliveryDetailsConfirmed], [IsCancelled], [CancellationReason], [IsPriceWaived], [CreatedBy], [CreatedAt], [Fulfillment], [RoutingStatus], [DeliveryTripId], [SettlementCustodyStatus]) VALUES
    (1, N'102826-001', N'Rodge Sanico', N'Imgen Sanico', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Gma', NULL, N'Liver Sauce Only, gandahan', 13500.0, NULL, 265.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 11765.0, 0, '2026-10-28 10:00:00', '2026-10-28 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 1, 1, N'Uncollected'),
    (2, N'102826-002', N'Mar Louie Libres', N'Mar Louie Libres', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Maguyam', NULL, N'gandahan', 13500.0, NULL, 250.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 0, NULL, NULL, 0.0, 13750.0, 0, '2026-10-28 16:00:00', '2026-10-28 15:00:00', 0, 0, NULL, 0, N'cashier', '2026-10-27 12:00:00', 1, 1, 1, N'Uncollected'),
    (3, N'102826-003', N'Jen Nagpiing', N'Jen Nagpiing', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, N'Liver Sauce Only, gandahan', 16500.0, NULL, 310.0, 11810.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 14810.0, 0, '2026-10-28 17:00:00', '2026-10-28 15:45:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 1, 2, N'Uncollected'),
    (4, N'102926-001', N'Desiree Fungo', N'Eerised Bonaagua', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Mang Bading nasa gitna ang venue', NULL, NULL, 13500.0, NULL, 0.0, 5000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13500.0, 0, '2026-10-29 09:00:00', '2026-10-29 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (5, N'102926-002', N'Fred Merene', N'Fred Merene', N'09000000000', N'Walk-in', NULL, 0, 0, N'Phase 10', NULL, NULL, 12000.0, NULL, 0.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 12000.0, 0, '2026-10-29 10:30:00', '2026-10-29 10:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (6, N'102926-003', N'jenny pablo', N'Annaliza Nunez', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Tagaytay', NULL, N'Dinuguan and Liver Sauce', 14000.0, NULL, 490.0, 0.0, N'None', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 1400.0, 13090.0, 0, '2026-10-29 15:00:00', '2026-10-29 14:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (7, N'102926-004', N'Erlinda Estampa', N'Rabi Janice', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, NULL, 14000.0, NULL, 265.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14265.0, 0, '2026-10-29 15:30:00', '2026-10-29 14:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (8, N'103026-001', N'Lydia Alpajora', N'Lydia Alpajora', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Pasig', NULL, NULL, 17500.0, NULL, 715.0, 500.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 18215.0, 0, '2026-10-30 10:30:00', '2026-10-30 08:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (9, N'103026-002', N'Marian Porton', N'Marian Porton', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Rosario', NULL, N'gandahan', 14000.0, NULL, 715.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14715.0, 0, '2026-10-30 14:00:00', '2026-10-30 12:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (10, N'103026-003', N'Jhonel Colot', N'Jhonel Colot', N'09000000000', N'Business FB Page', NULL, 0, 0, NULL, NULL, N'wala pa dp', 14000.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14000.0, 0, '2026-10-30 14:00:00', '2026-10-30 12:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (11, N'103026-004', N'John Hyman Eniong', N'John Hyman Eniong', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Silang', NULL, N'Liver Sauce Only', 16500.0, NULL, 490.0, 1990.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 14990.0, 0, '2026-10-30 17:00:00', '2026-10-30 15:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (12, N'103026-005', N'Liana San Lorenzo', N'Liana San Lorenzo', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, NULL, 15000.0, NULL, 400.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 15400.0, 0, '2026-10-30 18:00:00', '2026-10-30 17:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (13, N'103026-006', N'Analyn Alondra', N'Analyn Alondra', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Cabilang Baybay', NULL, N'ishout out', 11000.0, NULL, 0.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 11000.0, 0, '2026-10-30 17:30:00', '2026-10-30 17:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (14, N'103126-001', N'Dianne Belen', N'Dianne Belen', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, N'Liver Sauce Only + Additional 750 ml sarsa', 12700.0, N'Additional Sarsa (₱120)', 325.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 11145.0, 0, '2026-10-31 09:00:00', '2026-10-31 08:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (15, N'103126-002', N'Charles Abedejos', N'Charles Abedejos', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Muntinlupa', NULL, NULL, 12000.0, NULL, 340.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 0, NULL, NULL, 0.0, 12340.0, 0, '2026-10-31 10:30:00', '2026-10-31 09:00:00', 0, 0, NULL, 0, N'cashier', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (16, N'103126-003', N'Ana Perilla', N'Ana Perilla', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Imus', NULL, NULL, 10000.0, NULL, 535.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 10535.0, 0, '2026-10-31 12:00:00', '2026-10-31 10:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (17, N'103126-004', N'Ar Jhay', N'Ronald Jay Carillo', N'09000000000', N'Walk-in', NULL, 0, 0, N'Gentri', NULL, N'gandahan, vlogger si customer, Je Motovlog', 17500.0, NULL, 520.0, 9000.0, N'GCash', N'🎁 7 Freebies (Custom Swap)', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 18020.0, 0, '2026-10-31 13:30:00', '2026-10-31 12:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (18, N'103126-005', N'Janine Cadiz', N'Janine Cadiz', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Calamba', NULL, NULL, 15000.0, NULL, 520.0, 1520.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 15520.0, 0, '2026-10-31 15:00:00', '2026-10-31 13:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (19, N'103126-006', N'Bernadette Ann Diaz', N'Kristine Siguenza', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Cabilang Baybay', NULL, N'Liver Sauce Only', 14000.0, NULL, 0.0, 7000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 12000.0, 0, '2026-10-31 17:00:00', '2026-10-31 16:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (20, N'103126-007', N'Dayen Maglaque', N'Dayen Maglaque', N'09000000000', N'Business FB Page', NULL, 0, 0, NULL, NULL, N'pickup, Liver Sauce Only', 12700.0, NULL, 0.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 10700.0, 0, '2026-10-31 18:00:00', '2026-10-31 18:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (21, N'103126-008', N'Mama Gemma', N'Mama Gemma', N'09000000000', N'Business FB Page', NULL, 1, 1, NULL, NULL, NULL, 0.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 0.0, 0, '2026-10-31 12:00:00', NULL, 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (22, N'110126-001', N'Joanna Avelino', N'Naohj Avelino', N'09000000000', N'Business FB Page', NULL, 0, 0, N'San Pedro, Laguna', NULL, N'walang pansit kapalit 3 pcs of 750ml dinuguan', 12700.0, NULL, 325.0, 0.0, N'None', N'🎁 7 Freebies (Custom Swap)', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13025.0, 0, '2026-11-01 10:30:00', '2026-11-01 09:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (23, N'110126-002', N'Romel Cantejo', N'Rho Mhel', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Cabuyao', NULL, NULL, 14000.0, NULL, 325.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14325.0, 0, '2026-11-01 16:00:00', '2026-11-01 15:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (24, N'110126-003', N'Sherilmae Cano', N'Sherilmae Cano', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Amadeo', NULL, NULL, 12000.0, NULL, 445.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 0, NULL, NULL, 0.0, 12445.0, 0, '2026-11-01 17:00:00', '2026-11-01 16:00:00', 0, 0, NULL, 0, N'cashier', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (25, N'110126-004', N'Jonjon Antaran', N'Jonjon Antaran', N'09000000000', N'Business FB Page', NULL, 0, 0, NULL, NULL, N'wala pa dp', 14000.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14000.0, 0, '2026-11-01 18:00:00', '2026-11-01 16:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (26, N'110226-001', N'Roy Amadure', N'Roy Amadure', N'09000000000', N'Walk-in', NULL, 0, 0, N'Jamella private resort Maguyam', NULL, NULL, 15000.0, NULL, 250.0, 5000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 15250.0, 0, '2026-11-02 16:00:00', '2026-11-02 15:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (27, N'110326-001', N'Susan Hinahon Jonson', N'Cesar Jonson', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Naic', NULL, NULL, 16500.0, NULL, 730.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 17230.0, 0, '2026-11-03 14:00:00', '2026-11-03 12:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (28, N'110326-002', N'Mary Joy Pantila', N'Joy Pantila', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Gentri', NULL, NULL, 15000.0, NULL, 445.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 15445.0, 0, '2026-11-03 14:00:00', '2026-11-03 13:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (29, N'110326-003', N'Mary Jane Balabis', N'Mary Jane Balabis', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Maguyam', NULL, NULL, 14000.0, NULL, 250.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14250.0, 0, '2026-11-03 15:00:00', '2026-11-03 14:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (30, N'110326-004', N'badeth Beltran', N'Yell Garcia', N'09000000000', N'Business FB Page', NULL, 0, 0, NULL, NULL, N'kukunin laman loob / pickup', 300.0, NULL, 0.0, 0.0, N'None', NULL, NULL, 1, '2026-10-27 12:00:00', N'owner', 300.0, 0.0, 0, '2026-11-03 16:00:00', '2026-11-03 16:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (31, N'110426-001', N'Badeth Beltran', N'Yell Garcia', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Townhomes', NULL, N'walang dinuguan at puto', 10000.0, NULL, 0.0, 1000.0, N'GCash', N'🎁 7 Freebies (Custom Swap)', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 10000.0, 0, '2026-11-04 09:30:00', '2026-11-04 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (32, N'110526-001', N'Alfredson Loyola Molina', N'Alfredson Loyola Molina', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Naic', NULL, NULL, 17500.0, NULL, 715.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 18215.0, 0, '2026-11-05 10:30:00', '2026-11-05 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (33, N'110526-002', N'Zerah Ballatab', N'Annaliza Nunez', N'09000000000', N'Business FB Page', NULL, 1, 1, NULL, NULL, N'to follow ang time, dinuguan and sarsa only', 14000.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14000.0, 0, '2026-11-05 12:00:00', NULL, 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (34, N'110626-001', N'Cris Cantay', N'Cris Cantay', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Trece', NULL, NULL, 14000.0, NULL, 535.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14535.0, 0, '2026-11-06 10:00:00', '2026-11-06 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (35, N'110626-002', N'Edcyl Jimenez', N'Daniel Jimenez', N'09000000000', N'Business FB Page', NULL, 0, 0, NULL, NULL, N'wala pa dp', 12000.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 12000.0, 0, '2026-11-06 11:30:00', '2026-11-06 10:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (36, N'110626-003', N'Percibal Alipio', N'Percibal Alipio', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Calamba', NULL, N'wala pa dp', 11000.0, NULL, 520.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 11520.0, 0, '2026-11-06 20:00:00', '2026-11-06 18:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (37, N'110726-001', N'Brylle Pelayo', N'Bry Lee', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Imus', NULL, NULL, 13500.0, NULL, 535.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14035.0, 0, '2026-11-07 10:00:00', '2026-11-07 08:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (38, N'110726-002', N'Jay Andan', N'Mommie Laleyn', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Santa Rosa', NULL, N'wala pa dp', 12000.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 12000.0, 0, '2026-11-07 10:00:00', '2026-11-07 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (39, N'110726-003', N'Mailoh Villaluz', N'Mai-Loh Vee Villaluz', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Cavite City', NULL, NULL, 17500.0, NULL, 715.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 18215.0, 0, '2026-11-07 10:30:00', '2026-11-07 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (40, N'110726-004', N'Anthony Emata', N'Anthony Emata', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Imus', NULL, N'Liver Sauce Only', 11000.0, NULL, 505.0, 0.0, N'None', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 9505.0, 0, '2026-11-07 10:00:00', '2026-11-07 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (41, N'110726-005', N'Reynald Animos', N'Reynald Animos', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Gentri', NULL, NULL, 13500.0, NULL, 505.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14005.0, 0, '2026-11-07 12:00:00', '2026-11-07 10:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (42, N'110726-006', N'Kristine Joy Dominguez', N'Tine Dominguez', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Muntinlupa', NULL, NULL, 17500.0, NULL, 325.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 17825.0, 0, '2026-11-07 16:00:00', '2026-11-07 14:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (43, N'110726-007', N'Aisha Rose', N'Alex Diocales', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Binan', NULL, NULL, 14000.0, NULL, 250.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14250.0, 0, '2026-11-07 16:00:00', '2026-11-07 15:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (44, N'110726-008', N'Reann Tolentino', N'Reann Tolentino', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Gma', NULL, N'Liver Sauce Only', 12700.0, NULL, 250.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 10950.0, 0, '2026-11-07 16:00:00', '2026-11-07 15:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (45, N'110726-009', N'Sonia Loyola', N'Sonia Loyola', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Bancal', NULL, NULL, 16500.0, NULL, 0.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 16500.0, 0, '2026-11-07 17:00:00', '2026-11-07 16:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (46, N'110826-001', N'Cathrina Arinton', N'Cathy Arinton', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Trece', NULL, NULL, 11000.0, NULL, 535.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 11535.0, 0, '2026-11-08 11:00:00', '2026-11-08 10:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (47, N'110826-002', N'Izza Hernandez', N'Karen Ann Domingo', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Gma', NULL, NULL, 15000.0, NULL, 265.0, 3000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 15265.0, 0, '2026-11-08 11:30:00', '2026-11-08 10:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (48, N'110826-003', N'Emma', N'Winston Castro', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Makati', NULL, N'gandahan, Liver Sauce Only', 13500.0, NULL, 610.0, 0.0, N'None', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 12110.0, 0, '2026-11-08 12:45:00', '2026-11-08 10:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (49, N'110926-001', N'Carla Gatil', N'Carla Gatil', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, NULL, 13500.0, NULL, 355.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13855.0, 0, '2026-11-09 11:30:00', '2026-11-09 10:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (50, N'111026-001', N'Louiena Parba', N'Hernani Louie', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Paranaque', NULL, NULL, 13500.0, NULL, 505.0, 9500.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 14005.0, 0, '2026-11-10 16:00:00', '2026-11-10 14:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (51, N'111326-001', N'Alcmene Sevilla', N'Alcmene Sevilla', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Tanza', NULL, NULL, 12000.0, NULL, 595.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 12595.0, 0, '2026-11-13 17:30:00', '2026-11-13 16:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (52, N'111326-002', N'Angeline Vizcarra', N'Anj Vizcarra', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, N'Liver Sauce Only', 12700.0, NULL, 385.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 11085.0, 0, '2026-11-13 19:00:00', '2026-11-13 17:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (53, N'111426-001', N'Sheryl Landicho', N'Shen Landicho', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Maguyam', NULL, NULL, 13500.0, NULL, 250.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13750.0, 0, '2026-11-14 17:30:00', '2026-11-14 16:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (54, N'111526-001', N'Tan Agelo', N'Tan Agelo', N'09000000000', N'Business FB Page', NULL, 0, 0, N'San Juan, Manila', NULL, N'bawasan daw alat', 17500.0, NULL, 715.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 18215.0, 0, '2026-11-15 18:30:00', '2026-11-15 16:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (55, N'111926-001', N'Ericka Santos', N'EJ Santos', N'09000000000', N'Business FB Page', NULL, 0, 0, N'San Jose, Batangas', NULL, N'Liver Sauce Only', 12700.0, NULL, 1075.0, 1775.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 11775.0, 0, '2026-11-19 12:15:00', '2026-11-19 09:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (56, N'111926-002', N'Manny Pega', N'Manny Pega', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Tagaytay', NULL, N'Liver Sauce Only', 15000.0, NULL, 535.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 13535.0, 0, '2026-11-19 14:30:00', '2026-11-19 13:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (57, N'112126-001', N'Zeph Almazan', N'Tata', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Silang', NULL, N'Liver Sauce Only', 15000.0, NULL, 325.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 13325.0, 0, '2026-11-21 14:00:00', '2026-11-21 13:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (58, N'112226-001', N'Jhun Cardinoza', N'M Grace Cardinoza', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Imus', NULL, N'Liver Sauce Only', 16500.0, NULL, 565.0, 1000.0, N'GCash', N'🚫 No Freebies', N'{"optOut":true,"rawInnards":false}', 1, '2026-10-27 12:00:00', N'owner', 2000.0, 15065.0, 0, '2026-11-22 16:30:00', '2026-11-22 15:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (59, N'112326-001', N'Raymund Perida', N'Carlson DorothyJoy', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Trece', NULL, N'gandahan', 12700.0, NULL, 505.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13205.0, 0, '2026-11-23 12:00:00', '2026-11-23 10:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (60, N'112826-001', N'Micho Amparo', N'Micho Amparo', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Muntinlupa', NULL, NULL, 12700.0, NULL, 430.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13130.0, 0, '2026-11-28 08:30:00', '2026-11-28 08:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (61, N'112826-002', N'Richelle De Jesus', N'Reese De Jesus', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, NULL, 15000.0, NULL, 340.0, 5000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 15340.0, 0, '2026-11-28 12:30:00', '2026-11-28 11:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (62, N'112826-003', N'Cheryl Roberson', N'Cheryl Roberson', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Dasma', NULL, NULL, 10000.0, NULL, 400.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 10400.0, 0, '2026-11-28 17:00:00', '2026-11-28 16:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (63, N'112826-004', N'Randel Fuentes', N'Marie Rxy', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Bancal', NULL, NULL, 13500.0, NULL, 150.0, 4000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13650.0, 0, '2026-11-28 17:00:00', '2026-11-28 16:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (64, N'112826-005', N'Ronan Mapaquit', N'Ronan Mapaquit', N'09000000000', N'Walk-in', NULL, 0, 0, N'Viewfort', NULL, N'hiwalay deliver ng freebies, to follow oras ataddress', 13500.0, NULL, 100.0, 5000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13600.0, 0, '2026-11-28 18:00:00', '2026-11-28 17:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (65, N'112926-001', N'Mardi Sherwood', N'Mar Sher', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Gma', NULL, N'lalamove, gandahan at masarap', 2500.0, NULL, 0.0, 1000.0, N'GCash', NULL, NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 2500.0, 0, '2026-11-29 12:00:00', '2026-11-29 10:30:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (66, N'113026-001', N'Liberty Fernando', N'Liberty Fernando', N'09000000000', N'Business FB Page', NULL, 0, 0, N'Los Banos', NULL, N'reschedule, temporary date lang ito', 12700.0, NULL, 580.0, 1000.0, N'GCash', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13280.0, 0, '2026-11-30 15:30:00', '2026-11-30 14:00:00', 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 1, 0, NULL, N'Uncollected'),
    (67, N'120626-001', N'Rhudz Domingo', N'Rhudz Domingo', N'09000000000', N'Business FB Page', NULL, 1, 1, NULL, NULL, N'pickup, Liver Sauce and Dinuguan', 12700.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 12700.0, 0, '2026-12-06 12:00:00', NULL, 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (68, N'122026-001', N'Gemmalyne Gilbuena', N'Gemmalyne Gilbuena', N'09000000000', N'Business FB Page', NULL, 1, 1, NULL, NULL, N'magmemessage uli kasi Oct pa lang nagpareserve', 13500.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 13500.0, 0, '2026-12-20 12:00:00', NULL, 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected'),
    (69, N'122326-001', N'Miko', N'Annaliza nunes', N'09000000000', N'Business FB Page', NULL, 1, 1, NULL, NULL, N'wala pa time, Dinuguan and Sarsa', 12000.0, NULL, 0.0, 0.0, N'None', N'🎁 7 Freebies', NULL, 1, '2026-10-27 12:00:00', N'owner', 0.0, 12000.0, 0, '2026-12-23 12:00:00', NULL, 0, 0, NULL, 0, N'owner', '2026-10-27 12:00:00', 0, 0, NULL, N'Uncollected');

SET IDENTITY_INSERT [dbo].[Orders] OFF;

-- ----------------------------------------------------------------------------
-- Step 5: Seed OrderItems
-- ----------------------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[OrderItems] ON;

INSERT INTO [dbo].[OrderItems] ([Id], [OrderId], [ItemCategoryId], [Quantity], [Price], [TotalPrice], [CreatedAt]) VALUES
    (1, 1, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (2, 2, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (3, 3, 8, 1, 16500.0, 16500.0, '2026-10-27 12:00:00'),
    (4, 4, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (5, 5, 3, 1, 12000.0, 12000.0, '2026-10-27 12:00:00'),
    (6, 6, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (7, 7, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (8, 8, 9, 1, 17500.0, 17500.0, '2026-10-27 12:00:00'),
    (9, 9, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (10, 10, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (11, 11, 8, 1, 16500.0, 16500.0, '2026-10-27 12:00:00'),
    (12, 12, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (13, 13, 2, 1, 11000.0, 11000.0, '2026-10-27 12:00:00'),
    (14, 14, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (15, 14, 14, 1, 120.0, 120.0, '2026-10-27 12:00:00'),
    (16, 15, 3, 1, 12000.0, 12000.0, '2026-10-27 12:00:00'),
    (17, 16, 1, 1, 10000.0, 10000.0, '2026-10-27 12:00:00'),
    (18, 17, 9, 1, 17500.0, 17500.0, '2026-10-27 12:00:00'),
    (19, 18, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (20, 19, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (21, 20, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (22, 22, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (23, 23, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (24, 24, 3, 1, 12000.0, 12000.0, '2026-10-27 12:00:00'),
    (25, 25, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (26, 26, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (27, 27, 8, 1, 16500.0, 16500.0, '2026-10-27 12:00:00'),
    (28, 28, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (29, 29, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (30, 30, 21, 1, 300.0, 300.0, '2026-10-27 12:00:00'),
    (31, 31, 1, 1, 10000.0, 10000.0, '2026-10-27 12:00:00'),
    (32, 32, 9, 1, 17500.0, 17500.0, '2026-10-27 12:00:00'),
    (33, 33, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (34, 34, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (35, 35, 3, 1, 12000.0, 12000.0, '2026-10-27 12:00:00'),
    (36, 36, 2, 1, 11000.0, 11000.0, '2026-10-27 12:00:00'),
    (37, 37, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (38, 38, 3, 1, 12000.0, 12000.0, '2026-10-27 12:00:00'),
    (39, 39, 9, 1, 17500.0, 17500.0, '2026-10-27 12:00:00'),
    (40, 40, 2, 1, 11000.0, 11000.0, '2026-10-27 12:00:00'),
    (41, 41, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (42, 42, 9, 1, 17500.0, 17500.0, '2026-10-27 12:00:00'),
    (43, 43, 6, 1, 14000.0, 14000.0, '2026-10-27 12:00:00'),
    (44, 44, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (45, 45, 8, 1, 16500.0, 16500.0, '2026-10-27 12:00:00'),
    (46, 46, 2, 1, 11000.0, 11000.0, '2026-10-27 12:00:00'),
    (47, 47, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (48, 48, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (49, 49, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (50, 50, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (51, 51, 3, 1, 12000.0, 12000.0, '2026-10-27 12:00:00'),
    (52, 52, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (53, 53, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (54, 54, 9, 1, 17500.0, 17500.0, '2026-10-27 12:00:00'),
    (55, 55, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (56, 56, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (57, 57, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (58, 58, 8, 1, 16500.0, 16500.0, '2026-10-27 12:00:00'),
    (59, 59, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (60, 60, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (61, 61, 7, 1, 15000.0, 15000.0, '2026-10-27 12:00:00'),
    (62, 62, 1, 1, 10000.0, 10000.0, '2026-10-27 12:00:00'),
    (63, 63, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (64, 64, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (65, 65, 11, 1, 2500.0, 2500.0, '2026-10-27 12:00:00'),
    (66, 66, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (67, 67, 4, 1, 12700.0, 12700.0, '2026-10-27 12:00:00'),
    (68, 68, 5, 1, 13500.0, 13500.0, '2026-10-27 12:00:00'),
    (69, 69, 3, 1, 12000.0, 12000.0, '2026-10-27 12:00:00');

SET IDENTITY_INSERT [dbo].[OrderItems] OFF;

-- ----------------------------------------------------------------------------
-- Step 6: Seed OrderItemSchedules (63 Confirmed Roast Items)
-- ----------------------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[OrderItemSchedules] ON;

INSERT INTO [dbo].[OrderItemSchedules] ([Id], [OrderItemId], [TargetDeliveryTime], [PackagingStartTime], [SalangStartTime], [TahiStartTime], [CurrentStatus], [IsManualOverride], [CreatedAt]) VALUES
    (1, 1, '2026-10-28 10:00:00', '2026-10-28 08:30:00', '2026-10-28 05:30:00', '2026-10-28 04:30:00', 0, 0, '2026-10-27 12:00:00'),
    (2, 2, '2026-10-28 16:00:00', '2026-10-28 14:30:00', '2026-10-28 11:30:00', '2026-10-28 10:30:00', 0, 0, '2026-10-27 12:00:00'),
    (3, 3, '2026-10-28 17:00:00', '2026-10-28 15:15:00', '2026-10-28 10:45:00', '2026-10-28 09:45:00', 0, 0, '2026-10-27 12:00:00'),
    (4, 4, '2026-10-29 09:00:00', '2026-10-29 08:30:00', '2026-10-29 05:30:00', '2026-10-29 04:30:00', 0, 0, '2026-10-27 12:00:00'),
    (5, 5, '2026-10-29 10:30:00', '2026-10-29 10:00:00', '2026-10-29 07:30:00', '2026-10-29 06:30:00', 0, 0, '2026-10-27 12:00:00'),
    (6, 6, '2026-10-29 15:00:00', '2026-10-29 13:30:00', '2026-10-29 10:00:00', '2026-10-29 09:00:00', 0, 0, '2026-10-27 12:00:00'),
    (7, 7, '2026-10-29 15:30:00', '2026-10-29 14:00:00', '2026-10-29 10:30:00', '2026-10-29 09:30:00', 0, 0, '2026-10-27 12:00:00'),
    (8, 8, '2026-10-30 10:30:00', '2026-10-30 08:00:00', '2026-10-30 03:00:00', '2026-10-30 02:00:00', 0, 0, '2026-10-27 12:00:00'),
    (9, 9, '2026-10-30 14:00:00', '2026-10-30 11:30:00', '2026-10-30 08:00:00', '2026-10-30 07:00:00', 0, 0, '2026-10-27 12:00:00'),
    (10, 10, '2026-10-30 14:00:00', '2026-10-30 11:30:00', '2026-10-30 08:00:00', '2026-10-30 07:00:00', 0, 0, '2026-10-27 12:00:00'),
    (11, 11, '2026-10-30 17:00:00', '2026-10-30 15:00:00', '2026-10-30 10:30:00', '2026-10-30 09:30:00', 0, 0, '2026-10-27 12:00:00'),
    (12, 12, '2026-10-30 18:00:00', '2026-10-30 16:30:00', '2026-10-30 12:45:00', '2026-10-30 11:45:00', 0, 0, '2026-10-27 12:00:00'),
    (13, 13, '2026-10-30 17:30:00', '2026-10-30 16:30:00', '2026-10-30 14:00:00', '2026-10-30 13:00:00', 0, 0, '2026-10-27 12:00:00'),
    (14, 14, '2026-10-31 09:00:00', '2026-10-31 07:30:00', '2026-10-31 04:30:00', '2026-10-31 03:30:00', 0, 0, '2026-10-27 12:00:00'),
    (15, 16, '2026-10-31 10:30:00', '2026-10-31 08:30:00', '2026-10-31 06:00:00', '2026-10-31 05:00:00', 0, 0, '2026-10-27 12:00:00'),
    (16, 17, '2026-10-31 12:00:00', '2026-10-31 10:00:00', '2026-10-31 07:30:00', '2026-10-31 06:30:00', 0, 0, '2026-10-27 12:00:00'),
    (17, 18, '2026-10-31 13:30:00', '2026-10-31 12:00:00', '2026-10-31 07:00:00', '2026-10-31 06:00:00', 0, 0, '2026-10-27 12:00:00'),
    (18, 19, '2026-10-31 15:00:00', '2026-10-31 13:00:00', '2026-10-31 09:15:00', '2026-10-31 08:15:00', 0, 0, '2026-10-27 12:00:00'),
    (19, 20, '2026-10-31 17:00:00', '2026-10-31 16:00:00', '2026-10-31 12:30:00', '2026-10-31 11:30:00', 0, 0, '2026-10-27 12:00:00'),
    (20, 21, '2026-10-31 18:00:00', '2026-10-31 17:30:00', '2026-10-31 14:30:00', '2026-10-31 13:30:00', 0, 0, '2026-10-27 12:00:00'),
    (21, 22, '2026-11-01 10:30:00', '2026-11-01 09:00:00', '2026-11-01 06:00:00', '2026-11-01 05:00:00', 0, 0, '2026-10-27 12:00:00'),
    (22, 23, '2026-11-01 16:00:00', '2026-11-01 14:30:00', '2026-11-01 11:00:00', '2026-11-01 10:00:00', 0, 0, '2026-10-27 12:00:00'),
    (23, 24, '2026-11-01 17:00:00', '2026-11-01 15:30:00', '2026-11-01 13:00:00', '2026-11-01 12:00:00', 0, 0, '2026-10-27 12:00:00'),
    (24, 25, '2026-11-01 18:00:00', '2026-11-01 16:00:00', '2026-11-01 12:30:00', '2026-11-01 11:30:00', 0, 0, '2026-10-27 12:00:00'),
    (25, 26, '2026-11-02 16:00:00', '2026-11-02 14:30:00', '2026-11-02 10:45:00', '2026-11-02 09:45:00', 0, 0, '2026-10-27 12:00:00'),
    (26, 27, '2026-11-03 14:00:00', '2026-11-03 12:00:00', '2026-11-03 07:30:00', '2026-11-03 06:30:00', 0, 0, '2026-10-27 12:00:00'),
    (27, 28, '2026-11-03 14:00:00', '2026-11-03 12:30:00', '2026-11-03 08:45:00', '2026-11-03 07:45:00', 0, 0, '2026-10-27 12:00:00'),
    (28, 29, '2026-11-03 15:00:00', '2026-11-03 13:30:00', '2026-11-03 10:00:00', '2026-11-03 09:00:00', 0, 0, '2026-10-27 12:00:00'),
    (29, 31, '2026-11-04 09:30:00', '2026-11-04 08:30:00', '2026-11-04 06:00:00', '2026-11-04 05:00:00', 0, 0, '2026-10-27 12:00:00'),
    (30, 32, '2026-11-05 10:30:00', '2026-11-05 08:30:00', '2026-11-05 03:30:00', '2026-11-05 02:30:00', 0, 0, '2026-10-27 12:00:00'),
    (31, 34, '2026-11-06 10:00:00', '2026-11-06 08:30:00', '2026-11-06 05:00:00', '2026-11-06 04:00:00', 0, 0, '2026-10-27 12:00:00'),
    (32, 35, '2026-11-06 11:30:00', '2026-11-06 09:30:00', '2026-11-06 07:00:00', '2026-11-06 06:00:00', 0, 0, '2026-10-27 12:00:00'),
    (33, 36, '2026-11-06 20:00:00', '2026-11-06 17:30:00', '2026-11-06 15:00:00', '2026-11-06 14:00:00', 0, 0, '2026-10-27 12:00:00'),
    (34, 37, '2026-11-07 10:00:00', '2026-11-07 08:00:00', '2026-11-07 05:00:00', '2026-11-07 04:00:00', 0, 0, '2026-10-27 12:00:00'),
    (35, 38, '2026-11-07 10:00:00', '2026-11-07 08:30:00', '2026-11-07 06:00:00', '2026-11-07 05:00:00', 0, 0, '2026-10-27 12:00:00'),
    (36, 39, '2026-11-07 10:30:00', '2026-11-07 08:30:00', '2026-11-07 03:30:00', '2026-11-07 02:30:00', 0, 0, '2026-10-27 12:00:00'),
    (37, 40, '2026-11-07 10:00:00', '2026-11-07 08:30:00', '2026-11-07 06:00:00', '2026-11-07 05:00:00', 0, 0, '2026-10-27 12:00:00'),
    (38, 41, '2026-11-07 12:00:00', '2026-11-07 09:30:00', '2026-11-07 06:30:00', '2026-11-07 05:30:00', 0, 0, '2026-10-27 12:00:00'),
    (39, 42, '2026-11-07 16:00:00', '2026-11-07 14:00:00', '2026-11-07 09:00:00', '2026-11-07 08:00:00', 0, 0, '2026-10-27 12:00:00'),
    (40, 43, '2026-11-07 16:00:00', '2026-11-07 14:30:00', '2026-11-07 11:00:00', '2026-11-07 10:00:00', 0, 0, '2026-10-27 12:00:00'),
    (41, 44, '2026-11-07 16:00:00', '2026-11-07 14:30:00', '2026-11-07 11:30:00', '2026-11-07 10:30:00', 0, 0, '2026-10-27 12:00:00'),
    (42, 45, '2026-11-07 17:00:00', '2026-11-07 15:30:00', '2026-11-07 11:00:00', '2026-11-07 10:00:00', 0, 0, '2026-10-27 12:00:00'),
    (43, 46, '2026-11-08 11:00:00', '2026-11-08 09:30:00', '2026-11-08 07:00:00', '2026-11-08 06:00:00', 0, 0, '2026-10-27 12:00:00'),
    (44, 47, '2026-11-08 11:30:00', '2026-11-08 10:00:00', '2026-11-08 06:15:00', '2026-11-08 05:15:00', 0, 0, '2026-10-27 12:00:00'),
    (45, 48, '2026-11-08 12:45:00', '2026-11-08 10:00:00', '2026-11-08 07:00:00', '2026-11-08 06:00:00', 0, 0, '2026-10-27 12:00:00'),
    (46, 49, '2026-11-09 11:30:00', '2026-11-09 10:00:00', '2026-11-09 07:00:00', '2026-11-09 06:00:00', 0, 0, '2026-10-27 12:00:00'),
    (47, 50, '2026-11-10 16:00:00', '2026-11-10 14:00:00', '2026-11-10 11:00:00', '2026-11-10 10:00:00', 0, 0, '2026-10-27 12:00:00'),
    (48, 51, '2026-11-13 17:30:00', '2026-11-13 15:30:00', '2026-11-13 13:00:00', '2026-11-13 12:00:00', 0, 0, '2026-10-27 12:00:00'),
    (49, 52, '2026-11-13 19:00:00', '2026-11-13 17:00:00', '2026-11-13 14:00:00', '2026-11-13 13:00:00', 0, 0, '2026-10-27 12:00:00'),
    (50, 53, '2026-11-14 17:30:00', '2026-11-14 16:00:00', '2026-11-14 13:00:00', '2026-11-14 12:00:00', 0, 0, '2026-10-27 12:00:00'),
    (51, 54, '2026-11-15 18:30:00', '2026-11-15 16:00:00', '2026-11-15 11:00:00', '2026-11-15 10:00:00', 0, 0, '2026-10-27 12:00:00'),
    (52, 55, '2026-11-19 12:15:00', '2026-11-19 08:30:00', '2026-11-19 05:30:00', '2026-11-19 04:30:00', 0, 0, '2026-10-27 12:00:00'),
    (53, 56, '2026-11-19 14:30:00', '2026-11-19 12:30:00', '2026-11-19 08:45:00', '2026-11-19 07:45:00', 0, 0, '2026-10-27 12:00:00'),
    (54, 57, '2026-11-21 14:00:00', '2026-11-21 12:30:00', '2026-11-21 08:45:00', '2026-11-21 07:45:00', 0, 0, '2026-10-27 12:00:00'),
    (55, 58, '2026-11-22 16:30:00', '2026-11-22 14:30:00', '2026-11-22 10:00:00', '2026-11-22 09:00:00', 0, 0, '2026-10-27 12:00:00'),
    (56, 59, '2026-11-23 12:00:00', '2026-11-23 10:00:00', '2026-11-23 07:00:00', '2026-11-23 06:00:00', 0, 0, '2026-10-27 12:00:00'),
    (57, 60, '2026-11-28 08:30:00', '2026-11-28 08:00:00', '2026-11-28 05:00:00', '2026-11-28 04:00:00', 0, 0, '2026-10-27 12:00:00'),
    (58, 61, '2026-11-28 12:30:00', '2026-11-28 11:00:00', '2026-11-28 07:15:00', '2026-11-28 06:15:00', 0, 0, '2026-10-27 12:00:00'),
    (59, 62, '2026-11-28 17:00:00', '2026-11-28 15:30:00', '2026-11-28 13:00:00', '2026-11-28 12:00:00', 0, 0, '2026-10-27 12:00:00'),
    (60, 63, '2026-11-28 17:00:00', '2026-11-28 16:00:00', '2026-11-28 13:00:00', '2026-11-28 12:00:00', 0, 0, '2026-10-27 12:00:00'),
    (61, 64, '2026-11-28 18:00:00', '2026-11-28 17:00:00', '2026-11-28 14:00:00', '2026-11-28 13:00:00', 0, 0, '2026-10-27 12:00:00'),
    (62, 65, '2026-11-29 12:00:00', '2026-11-29 10:15:00', '2026-11-29 08:15:00', '2026-11-29 07:45:00', 0, 0, '2026-10-27 12:00:00'),
    (63, 66, '2026-11-30 15:30:00', '2026-11-30 13:30:00', '2026-11-30 10:30:00', '2026-11-30 09:30:00', 0, 0, '2026-10-27 12:00:00');

SET IDENTITY_INSERT [dbo].[OrderItemSchedules] OFF;

-- ----------------------------------------------------------------------------
-- Step 7: Seed InventoryReservations (63 Confirmed Roast Items)
-- ----------------------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[InventoryReservations] ON;

INSERT INTO [dbo].[InventoryReservations] ([Id], [OrderId], [ItemCategoryId], [ReservationDate], [Status], [ReservationStatus], [IsCancelled], [CreatedAt]) VALUES
    (1, 1, 5, '2026-10-28 10:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (2, 2, 5, '2026-10-28 16:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (3, 3, 8, '2026-10-28 17:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (4, 4, 5, '2026-10-29 09:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (5, 5, 3, '2026-10-29 10:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (6, 6, 6, '2026-10-29 15:00:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (7, 7, 6, '2026-10-29 15:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (8, 8, 9, '2026-10-30 10:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (9, 9, 6, '2026-10-30 14:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (10, 10, 6, '2026-10-30 14:00:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (11, 11, 8, '2026-10-30 17:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (12, 12, 7, '2026-10-30 18:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (13, 13, 2, '2026-10-30 17:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (14, 14, 4, '2026-10-31 09:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (15, 15, 3, '2026-10-31 10:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (16, 16, 1, '2026-10-31 12:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (17, 17, 9, '2026-10-31 13:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (18, 18, 7, '2026-10-31 15:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (19, 19, 6, '2026-10-31 17:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (20, 20, 4, '2026-10-31 18:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (21, 22, 4, '2026-11-01 10:30:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (22, 23, 6, '2026-11-01 16:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (23, 24, 3, '2026-11-01 17:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (24, 25, 6, '2026-11-01 18:00:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (25, 26, 7, '2026-11-02 16:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (26, 27, 8, '2026-11-03 14:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (27, 28, 7, '2026-11-03 14:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (28, 29, 6, '2026-11-03 15:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (29, 31, 1, '2026-11-04 09:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (30, 32, 9, '2026-11-05 10:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (31, 34, 6, '2026-11-06 10:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (32, 35, 3, '2026-11-06 11:30:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (33, 36, 2, '2026-11-06 20:00:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (34, 37, 5, '2026-11-07 10:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (35, 38, 3, '2026-11-07 10:00:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (36, 39, 9, '2026-11-07 10:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (37, 40, 2, '2026-11-07 10:00:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (38, 41, 5, '2026-11-07 12:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (39, 42, 9, '2026-11-07 16:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (40, 43, 6, '2026-11-07 16:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (41, 44, 4, '2026-11-07 16:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (42, 45, 8, '2026-11-07 17:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (43, 46, 2, '2026-11-08 11:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (44, 47, 7, '2026-11-08 11:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (45, 48, 5, '2026-11-08 12:45:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (46, 49, 5, '2026-11-09 11:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (47, 50, 5, '2026-11-10 16:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (48, 51, 3, '2026-11-13 17:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (49, 52, 4, '2026-11-13 19:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (50, 53, 5, '2026-11-14 17:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (51, 54, 9, '2026-11-15 18:30:00', 0, 0, 0, '2026-10-27 12:00:00'),
    (52, 55, 4, '2026-11-19 12:15:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (53, 56, 7, '2026-11-19 14:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (54, 57, 7, '2026-11-21 14:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (55, 58, 8, '2026-11-22 16:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (56, 59, 4, '2026-11-23 12:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (57, 60, 4, '2026-11-28 08:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (58, 61, 7, '2026-11-28 12:30:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (59, 62, 1, '2026-11-28 17:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (60, 63, 5, '2026-11-28 17:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (61, 64, 5, '2026-11-28 18:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (62, 65, 11, '2026-11-29 12:00:00', 1, 1, 0, '2026-10-27 12:00:00'),
    (63, 66, 4, '2026-11-30 15:30:00', 1, 1, 0, '2026-10-27 12:00:00');

SET IDENTITY_INSERT [dbo].[InventoryReservations] OFF;

-- ----------------------------------------------------------------------------
-- Step 8: Seed PaymentLogs (Logged Downpayments)
-- ----------------------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[PaymentLogs] ON;

INSERT INTO [dbo].[PaymentLogs] ([Id], [OrderId], [GatewayReferenceId], [Provider], [PaymentMethod], [Amount], [Status], [CreatedAt]) VALUES
    (1, 1, N'SEED-DP-102826-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (2, 2, N'SEED-DP-102826-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (3, 3, N'SEED-DP-102826-003', 1, N'GCash', 11810.0, 1, '2026-10-27 12:00:00'),
    (4, 4, N'SEED-DP-102926-001', 1, N'GCash', 5000.0, 1, '2026-10-27 12:00:00'),
    (5, 5, N'SEED-DP-102926-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (6, 7, N'SEED-DP-102926-004', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (7, 8, N'SEED-DP-103026-001', 1, N'GCash', 500.0, 1, '2026-10-27 12:00:00'),
    (8, 9, N'SEED-DP-103026-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (9, 11, N'SEED-DP-103026-004', 1, N'GCash', 1990.0, 1, '2026-10-27 12:00:00'),
    (10, 12, N'SEED-DP-103026-005', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (11, 13, N'SEED-DP-103026-006', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (12, 14, N'SEED-DP-103126-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (13, 15, N'SEED-DP-103126-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (14, 16, N'SEED-DP-103126-003', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (15, 17, N'SEED-DP-103126-004', 1, N'GCash', 9000.0, 1, '2026-10-27 12:00:00'),
    (16, 18, N'SEED-DP-103126-005', 1, N'GCash', 1520.0, 1, '2026-10-27 12:00:00'),
    (17, 19, N'SEED-DP-103126-006', 1, N'GCash', 7000.0, 1, '2026-10-27 12:00:00'),
    (18, 20, N'SEED-DP-103126-007', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (19, 23, N'SEED-DP-110126-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (20, 24, N'SEED-DP-110126-003', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (21, 26, N'SEED-DP-110226-001', 1, N'GCash', 5000.0, 1, '2026-10-27 12:00:00'),
    (22, 27, N'SEED-DP-110326-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (23, 28, N'SEED-DP-110326-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (24, 29, N'SEED-DP-110326-003', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (25, 31, N'SEED-DP-110426-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (26, 32, N'SEED-DP-110526-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (27, 34, N'SEED-DP-110626-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (28, 37, N'SEED-DP-110726-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (29, 39, N'SEED-DP-110726-003', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (30, 41, N'SEED-DP-110726-005', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (31, 42, N'SEED-DP-110726-006', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (32, 43, N'SEED-DP-110726-007', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (33, 44, N'SEED-DP-110726-008', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (34, 45, N'SEED-DP-110726-009', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (35, 46, N'SEED-DP-110826-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (36, 47, N'SEED-DP-110826-002', 1, N'GCash', 3000.0, 1, '2026-10-27 12:00:00'),
    (37, 49, N'SEED-DP-110926-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (38, 50, N'SEED-DP-111026-001', 1, N'GCash', 9500.0, 1, '2026-10-27 12:00:00'),
    (39, 51, N'SEED-DP-111326-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (40, 52, N'SEED-DP-111326-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (41, 53, N'SEED-DP-111426-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (42, 55, N'SEED-DP-111926-001', 1, N'GCash', 1775.0, 1, '2026-10-27 12:00:00'),
    (43, 56, N'SEED-DP-111926-002', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (44, 57, N'SEED-DP-112126-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (45, 58, N'SEED-DP-112226-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (46, 59, N'SEED-DP-112326-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (47, 60, N'SEED-DP-112826-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (48, 61, N'SEED-DP-112826-002', 1, N'GCash', 5000.0, 1, '2026-10-27 12:00:00'),
    (49, 62, N'SEED-DP-112826-003', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (50, 63, N'SEED-DP-112826-004', 1, N'GCash', 4000.0, 1, '2026-10-27 12:00:00'),
    (51, 64, N'SEED-DP-112826-005', 1, N'GCash', 5000.0, 1, '2026-10-27 12:00:00'),
    (52, 65, N'SEED-DP-112926-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00'),
    (53, 66, N'SEED-DP-113026-001', 1, N'GCash', 1000.0, 1, '2026-10-27 12:00:00');

SET IDENTITY_INSERT [dbo].[PaymentLogs] OFF;

COMMIT TRANSACTION;

-- End of script