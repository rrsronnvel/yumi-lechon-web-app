using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using LechonSystem.Api.Common;

namespace LechonSystem.Api.Data;

public static class QaDataSeeder
{
    public static async Task SeedQaDataAsync(IServiceProvider serviceProvider)
    {
        var logger = serviceProvider.GetService<ILoggerFactory>()?.CreateLogger("QaDataSeeder");
        var context = serviceProvider.GetRequiredService<LechonDbContext>();
        var schedulingService = serviceProvider.GetRequiredService<ISchedulingService>();
        var inventoryService = serviceProvider.GetRequiredService<IInventoryService>();

        // 1. Seed Customer Profiles (always ensure intelligence records are populated/updated)
        await SeedCustomerProfilesAsync(context);

        // 1b. Ensure local test owner account 'cholo' is provisioned
        var existingCholo = await context.Users.FirstOrDefaultAsync(u => u.Username == "cholo");
        if (existingCholo == null)
        {
            context.Users.Add(new User
            {
                Username = "cholo",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("cholo123"),
                FullName = "Cholo",
                Role = "Owner",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
            logger?.LogInformation("QA Test Data: Local test owner account 'cholo' provisioned.");
        }

        // 2. Clean up old test orders matching references -901 to -905
        var oldOrders = await context.Orders
            .Include(o => o.OrderItems)
            .Where(o => o.OrderReference.StartsWith("QA-") ||
                        o.OrderReference.EndsWith("-901") ||
                        o.OrderReference.EndsWith("-902") ||
                        o.OrderReference.EndsWith("-903") ||
                        o.OrderReference.EndsWith("-904") ||
                        o.OrderReference.EndsWith("-905") ||
                        o.CustomerName.Contains("(Finding 3 Test)") ||
                        o.CustomerName.Contains("(38km Long Haul)") ||
                        o.CustomerName.Contains("(Pickup Anchor)") ||
                        o.CustomerName.StartsWith("Carding Dalisay") ||
                        o.CustomerName.StartsWith("Maricel Soriano") ||
                        o.CustomerName.StartsWith("Vic Sotto"))
            .ToListAsync();

        if (oldOrders.Count > 0)
        {
            logger?.LogInformation("QA Test Data: Cleaning up {Count} previous test order(s)...", oldOrders.Count);
            var oldOrderIds = oldOrders.Select(o => o.Id).ToList();
            var oldItemIds = oldOrders.SelectMany(o => o.OrderItems).Select(oi => oi.Id).ToList();

            var schedules = await context.OrderItemSchedules
                .Where(s => oldItemIds.Contains(s.OrderItemId))
                .ToListAsync();
            context.OrderItemSchedules.RemoveRange(schedules);

            var reservations = await context.InventoryReservations
                .Where(r => oldOrderIds.Contains(r.OrderId))
                .ToListAsync();
            context.InventoryReservations.RemoveRange(reservations);

            var payments = await context.PaymentLogs
                .Where(p => oldOrderIds.Contains(p.OrderId) || p.GatewayReferenceId.StartsWith("QA-"))
                .ToListAsync();
            context.PaymentLogs.RemoveRange(payments);

            var auditLogs = await context.OrderAuditLogs
                .Where(a => oldOrderIds.Contains(a.OrderId))
                .ToListAsync();
            context.OrderAuditLogs.RemoveRange(auditLogs);

            var items = await context.OrderItems
                .Where(oi => oldOrderIds.Contains(oi.OrderId))
                .ToListAsync();
            context.OrderItems.RemoveRange(items);

            context.Orders.RemoveRange(oldOrders);
            await context.SaveChangesAsync();
        }

        var todayPht = PhilippineTime.Today; // 2026-10-29
        logger?.LogInformation("QA Test Data: Seeding 3 targeted test orders for today {Today}...", todayPht.ToString("yyyy-MM-dd"));

        // =========================================================================
        // Scenario A — Store Pickup Pending Counter Settlement (Tests Store Pickups Tab, VIP & WI Badges)
        // Order Reference: #102926-903
        // =========================================================================
        var orderA = new Order
        {
            OrderReference = "102926-903",
            CustomerName = "Carding Dalisay (WI)",
            FacebookName = "Carding Dalisay",
            ContactNumber = "09182223333",
            Source = "Walk-in",
            EventType = "Walk-in Pickup",
            Fulfillment = FulfillmentType.Pickup,
            TargetDeliveryTime = todayPht.AddHours(15), // 2026-10-29 15:00:00 (Today 3:00 PM)
            RiderDepartureTime = todayPht.AddHours(15),
            DeliveryAddress = "Walk-in Store Counter",
            Landmark = "Near Imus Cathedral",
            Remarks = "Walk-in Store Pickup • 👑 VIP Customer",
            DeliveryFee = 0.00m,
            Downpayment = 2000.00m,
            DownpaymentMethod = "GCash",
            Discount = 0.00m,
            Price = 12000.00m,
            GrandTotal = 12000.00m,
            IsTrustedCustomer = true, // 👑 VIP
            IsDeliveryDetailsConfirmed = true,
            SettlementCustodyStatus = "Uncollected",
            RoutingStatus = DeliveryStatus.Unassigned,
            CreatedBy = "Store Cashier (@cashier)",
            CreatedAt = todayPht.AddHours(9)
        };

        var orderAItem = new OrderItem
        {
            ItemCategoryId = 3, // S (Whole Lechon 20-21kg) (12,000)
            Quantity = 1,
            Price = 12000.00m,
            TotalPrice = 12000.00m,
            CreatedAt = todayPht.AddHours(9)
        };
        orderA.OrderItems.Add(orderAItem);
        context.Orders.Add(orderA);
        await context.SaveChangesAsync();

        var scheduleA = await schedulingService.CalculateScheduleAsync(
            orderAItem.Id,
            orderA.TargetDeliveryTime!.Value,
            orderAItem.ItemCategoryId,
            orderA.RiderDepartureTime
        );
        context.OrderItemSchedules.Add(scheduleA);

        await inventoryService.CreatePendingReservationAsync(
            orderA.Id,
            orderAItem.ItemCategoryId,
            orderA.TargetDeliveryTime!.Value,
            orderA.IsTrustedCustomer,
            orderA.Downpayment
        );

        context.PaymentLogs.Add(new PaymentLog
        {
            OrderId = orderA.Id,
            GatewayReferenceId = $"QA-{orderA.OrderReference}-DP",
            Provider = PaymentProvider.ManualGCash,
            PaymentMethod = "GCash",
            Amount = orderA.Downpayment,
            Status = PaymentStatus.Success,
            CreatedAt = todayPht.AddHours(9)
        });

        context.OrderAuditLogs.Add(new OrderAuditLog
        {
            OrderId = orderA.Id,
            ActionType = "Order Created",
            Changes = $"Order #{orderA.OrderReference} created for {orderA.CustomerName} (Total: ₱{orderA.GrandTotal:N2})",
            ChangedBy = "Store Cashier (@cashier)",
            Timestamp = todayPht.AddHours(9),
            CreatedAt = todayPht.AddHours(9)
        });

        // =========================================================================
        // Scenario B — Delivery in Drawer Held by Cashier (Tests Custody Breakdown Pill 1)
        // Order Reference: #102926-904
        // =========================================================================
        var deliveryTrip = await context.DeliveryTrips.FirstOrDefaultAsync(t => t.RiderName == "AL");
        if (deliveryTrip == null)
        {
            deliveryTrip = new DeliveryTrip
            {
                RiderName = "AL",
                VehicleType = "Motorcycle",
                Status = DeliveryStatus.Delivered,
                DispatchTime = todayPht.AddHours(10).AddMinutes(30),
                ActualReturnTime = todayPht.AddHours(12),
                CreatedAt = todayPht.AddHours(10)
            };
            context.DeliveryTrips.Add(deliveryTrip);
            await context.SaveChangesAsync();
        }

        var orderB = new Order
        {
            OrderReference = "102926-904",
            CustomerName = "Maricel Soriano",
            FacebookName = "Maricel Soriano Official",
            ContactNumber = "09175551122",
            Source = "Business FB Page",
            EventType = "Birthday Delivery",
            Fulfillment = FulfillmentType.Delivery,
            TargetDeliveryTime = todayPht.AddHours(11).AddMinutes(30), // 2026-10-29 11:30:00
            RiderDepartureTime = todayPht.AddHours(10).AddMinutes(30),
            DeliveryAddress = "Diamond St, Golden City, Imus, Cavite",
            Landmark = "Yellow Gate with CCTV",
            Remarks = "Standard 7 freebies included",
            DeliveryFee = 400.00m,
            Downpayment = 1000.00m,
            DownpaymentMethod = "GCash",
            Discount = 0.00m,
            Price = 12700.00m,
            GrandTotal = 13100.00m,
            IsTrustedCustomer = false,
            IsDeliveryDetailsConfirmed = true,
            SettlementCustodyStatus = "InStaffDrawer",
            HeldByStaffMethod = "Cash",
            StaffValidatedBy = "Store Cashier (@cashier)",
            StaffValidatedAt = todayPht.AddHours(12), // 2026-10-29 12:00:00
            RiderSignedBy = "AL",
            RiderRemittedAmount = 12100.00m,
            RiderSignedAt = todayPht.AddHours(12),
            DeliveryTripId = deliveryTrip.Id,
            RoutingStatus = DeliveryStatus.Delivered,
            CreatedBy = "Store Cashier (@cashier)",
            CreatedAt = todayPht.AddHours(8)
        };

        var orderBItem = new OrderItem
        {
            ItemCategoryId = 4, // M (Whole Lechon 22-24kg) (12,700)
            Quantity = 1,
            Price = 12700.00m,
            TotalPrice = 12700.00m,
            CreatedAt = todayPht.AddHours(8)
        };
        orderB.OrderItems.Add(orderBItem);
        context.Orders.Add(orderB);
        await context.SaveChangesAsync();

        var scheduleB = await schedulingService.CalculateScheduleAsync(
            orderBItem.Id,
            orderB.TargetDeliveryTime!.Value,
            orderBItem.ItemCategoryId,
            orderB.RiderDepartureTime
        );
        context.OrderItemSchedules.Add(scheduleB);

        await inventoryService.CreatePendingReservationAsync(
            orderB.Id,
            orderBItem.ItemCategoryId,
            orderB.TargetDeliveryTime!.Value,
            orderB.IsTrustedCustomer,
            orderB.Downpayment
        );

        context.PaymentLogs.Add(new PaymentLog
        {
            OrderId = orderB.Id,
            GatewayReferenceId = $"QA-{orderB.OrderReference}-DP",
            Provider = PaymentProvider.ManualGCash,
            PaymentMethod = "GCash",
            Amount = orderB.Downpayment,
            Status = PaymentStatus.Success,
            CreatedAt = todayPht.AddHours(8)
        });

        context.OrderAuditLogs.Add(new OrderAuditLog
        {
            OrderId = orderB.Id,
            ActionType = "Custody: In Staff Drawer",
            Changes = $"Rider AL remitted ₱12,100.00 via Cash. Validated into drawer by Store Cashier (@cashier).",
            ChangedBy = "Store Cashier (@cashier)",
            Timestamp = todayPht.AddHours(12),
            CreatedAt = todayPht.AddHours(12)
        });

        // =========================================================================
        // Scenario C — Store Pickup in Drawer Held by Cholo (Tests Custody Breakdown Pill 2)
        // Order Reference: #102926-905
        // =========================================================================
        var orderC = new Order
        {
            OrderReference = "102926-905",
            CustomerName = "Vic Sotto (WI)",
            FacebookName = "Vic Sotto",
            ContactNumber = "09183334455",
            Source = "Walk-in",
            EventType = "Family Lunch",
            Fulfillment = FulfillmentType.Pickup,
            TargetDeliveryTime = todayPht.AddHours(13), // 2026-10-29 13:00:00 (Today 1:00 PM)
            RiderDepartureTime = todayPht.AddHours(13),
            DeliveryAddress = "Counter Pickup",
            Landmark = "Walk-in Store Pickup",
            Remarks = "1x Belly 3kg hot and crispy",
            DeliveryFee = 0.00m,
            Downpayment = 1000.00m,
            DownpaymentMethod = "GCash",
            Discount = 0.00m,
            Price = 2500.00m,
            GrandTotal = 2500.00m,
            IsTrustedCustomer = false,
            IsDeliveryDetailsConfirmed = true,
            SettlementCustodyStatus = "InStaffDrawer",
            HeldByStaffMethod = "Cash",
            StaffValidatedBy = "Cholo (@cholo)",
            StaffValidatedAt = todayPht.AddHours(13).AddMinutes(30), // 2026-10-29 13:30:00
            RiderSignedBy = "Vic Sotto",
            RoutingStatus = DeliveryStatus.Delivered,
            CreatedBy = "Cholo (@cholo)",
            CreatedAt = todayPht.AddHours(9)
        };

        var orderCItem = new OrderItem
        {
            ItemCategoryId = 11, // Belly 3kg (2,500)
            Quantity = 1,
            Price = 2500.00m,
            TotalPrice = 2500.00m,
            CreatedAt = todayPht.AddHours(9)
        };
        orderC.OrderItems.Add(orderCItem);
        context.Orders.Add(orderC);
        await context.SaveChangesAsync();

        var scheduleC = await schedulingService.CalculateScheduleAsync(
            orderCItem.Id,
            orderC.TargetDeliveryTime!.Value,
            orderCItem.ItemCategoryId,
            orderC.RiderDepartureTime
        );
        context.OrderItemSchedules.Add(scheduleC);

        await inventoryService.CreatePendingReservationAsync(
            orderC.Id,
            orderCItem.ItemCategoryId,
            orderC.TargetDeliveryTime!.Value,
            orderC.IsTrustedCustomer,
            orderC.Downpayment
        );

        context.PaymentLogs.Add(new PaymentLog
        {
            OrderId = orderC.Id,
            GatewayReferenceId = $"QA-{orderC.OrderReference}-DP",
            Provider = PaymentProvider.ManualGCash,
            PaymentMethod = "GCash",
            Amount = orderC.Downpayment,
            Status = PaymentStatus.Success,
            CreatedAt = todayPht.AddHours(9)
        });

        context.OrderAuditLogs.Add(new OrderAuditLog
        {
            OrderId = orderC.Id,
            ActionType = "Custody: In Staff Drawer",
            Changes = $"Counter pickup balance ₱1,500.00 collected via Cash. Validated into drawer by Cholo (@cholo).",
            ChangedBy = "Cholo (@cholo)",
            Timestamp = todayPht.AddHours(13).AddMinutes(30),
            CreatedAt = todayPht.AddHours(13).AddMinutes(30)
        });

        await context.SaveChangesAsync();
        logger?.LogInformation("QA Test Data: Successfully seeded 3 targeted test orders (#102926-903, #102926-904, #102926-905).");

        // =========================================================================
        // Order #110626-921: Piolo Pascual (Nov 6 Delivery, AL Rider, ₱12,000 Uncollected)
        // =========================================================================
        var order921 = await context.Orders.Include(o => o.OrderItems).FirstOrDefaultAsync(o => o.OrderReference == "110626-921");
        if (order921 == null)
        {
            var alTrip = await context.DeliveryTrips.FirstOrDefaultAsync(t => t.RiderName == "AL");
            if (alTrip == null)
            {
                alTrip = new DeliveryTrip
                {
                    RiderName = "AL",
                    VehicleType = "Motorcycle",
                    Status = DeliveryStatus.Assigned,
                    DispatchTime = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                context.DeliveryTrips.Add(alTrip);
                await context.SaveChangesAsync();
            }

            order921 = new Order
            {
                OrderReference = "110626-921",
                CustomerName = "Piolo Pascual",
                FacebookName = "Piolo Pascual Official",
                ContactNumber = "09170000921",
                Source = "Business FB Page",
                Fulfillment = FulfillmentType.Delivery,
                TargetDeliveryTime = new DateTime(2026, 11, 6, 15, 0, 0),
                RiderDepartureTime = new DateTime(2026, 11, 6, 14, 0, 0),
                DeliveryAddress = "Bacoor, Cavite",
                Landmark = "Near Bacoor City Hall",
                Remarks = "QA Seed Order #110626-921",
                Price = 13500.00m,
                DeliveryFee = 350.00m,
                Downpayment = 1850.00m,
                DownpaymentMethod = "GCash",
                GrandTotal = 13850.00m,
                Discount = 0.00m,
                IsTrustedCustomer = false,
                IsDeliveryDetailsConfirmed = true,
                SettlementCustodyStatus = "Uncollected",
                RoutingStatus = DeliveryStatus.Assigned,
                DeliveryTripId = alTrip.Id,
                FreebiesSummary = "🎁 7 Whole Lechon Freebies",
                FreebiesConfigJson = "{\"optOut\":false,\"pigsWithFreebies\":1,\"rawInnards\":false,\"counts\":{\"Sarsa\":1,\"1.5L Coke\":1,\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Dinuguan\":1,\"Puto\":1},\"customizationNote\":\"\",\"bellyCounts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0},\"bellyCustomizationNote\":\"\",\"bellySignature\":\"\"}",
                CreatedBy = "QA Seed Nov 06",
                CreatedAt = DateTime.UtcNow
            };
            context.Orders.Add(order921);
            await context.SaveChangesAsync();

            var order921Item = new OrderItem
            {
                OrderId = order921.Id,
                ItemCategoryId = 5, // L Lechon
                Quantity = 1,
                Price = 13500.00m,
                TotalPrice = 13500.00m,
                CreatedAt = DateTime.UtcNow
            };
            context.OrderItems.Add(order921Item);
            await context.SaveChangesAsync();

            context.OrderItemSchedules.Add(new OrderItemSchedule
            {
                OrderItemId = order921Item.Id,
                TargetDeliveryTime = order921.TargetDeliveryTime.Value,
                PackagingStartTime = new DateTime(2026, 11, 6, 13, 30, 0),
                SalangStartTime = new DateTime(2026, 11, 6, 10, 30, 0),
                TahiStartTime = new DateTime(2026, 11, 6, 9, 30, 0),
                IsManualOverride = false,
                CurrentStatus = ProductionStatus.Defrosting,
                CreatedAt = DateTime.UtcNow
            });

            context.PaymentLogs.Add(new PaymentLog
            {
                OrderId = order921.Id,
                GatewayReferenceId = "QA-110626-921-DP",
                Provider = PaymentProvider.ManualGCash,
                PaymentMethod = "GCash",
                Amount = 1850.00m,
                Status = PaymentStatus.Success,
                CreatedAt = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
            logger?.LogInformation("QA Test Data: Successfully seeded order #110626-921 (Piolo Pascual).");
        }

        // =========================================================================
        // Order #110626-922: Sam Sam (Nov 7 Lalamove, 1x Belly 5kg, ₱3,200 Uncollected)
        // =========================================================================
        var order922 = await context.Orders.Include(o => o.OrderItems).FirstOrDefaultAsync(o => o.OrderReference == "110626-922");
        if (order922 == null)
        {
            order922 = new Order
            {
                OrderReference = "110626-922",
                CustomerName = "Sam Sam",
                FacebookName = "Sam Sam",
                ContactNumber = "09170000922",
                Source = "Business FB Page",
                Fulfillment = FulfillmentType.Lalamove,
                TargetDeliveryTime = new DateTime(2026, 11, 7, 12, 0, 0),
                RiderDepartureTime = new DateTime(2026, 11, 7, 12, 0, 0),
                DeliveryAddress = "Imus, Cavite",
                Landmark = "Near Imus Market",
                Remarks = "QA Seed Order #110626-922",
                Price = 4200.00m,
                DeliveryFee = 0.00m,
                Downpayment = 1000.00m,
                DownpaymentMethod = "GCash",
                GrandTotal = 4200.00m,
                Discount = 0.00m,
                IsTrustedCustomer = false,
                IsDeliveryDetailsConfirmed = true,
                SettlementCustodyStatus = "Uncollected",
                RoutingStatus = DeliveryStatus.Unassigned,
                FreebiesSummary = "🎁 Belly Freebies: 1x Sarsa, 1x Pancit",
                FreebiesConfigJson = "{\"optOut\":false,\"pigsWithFreebies\":0,\"rawInnards\":false,\"counts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0},\"customizationNote\":\"\",\"bellyCounts\":{\"Sarsa\":1,\"1.5L Coke\":0,\"Pancit\":1,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0},\"bellyCustomizationNote\":\"\",\"bellySignature\":\"5x1\"}",
                CreatedBy = "QA Seed Nov 06",
                CreatedAt = DateTime.UtcNow
            };
            context.Orders.Add(order922);
            await context.SaveChangesAsync();

            var order922Item = new OrderItem
            {
                OrderId = order922.Id,
                ItemCategoryId = 13, // Belly 5kg
                Quantity = 1,
                Price = 4200.00m,
                TotalPrice = 4200.00m,
                CreatedAt = DateTime.UtcNow
            };
            context.OrderItems.Add(order922Item);
            await context.SaveChangesAsync();

            context.OrderItemSchedules.Add(new OrderItemSchedule
            {
                OrderItemId = order922Item.Id,
                TargetDeliveryTime = order922.TargetDeliveryTime.Value,
                PackagingStartTime = new DateTime(2026, 11, 7, 11, 45, 0),
                SalangStartTime = new DateTime(2026, 11, 7, 9, 30, 0),
                TahiStartTime = new DateTime(2026, 11, 7, 9, 0, 0),
                IsManualOverride = false,
                CurrentStatus = ProductionStatus.Defrosting,
                CreatedAt = DateTime.UtcNow
            });

            context.PaymentLogs.Add(new PaymentLog
            {
                OrderId = order922.Id,
                GatewayReferenceId = "QA-110626-922-DP",
                Provider = PaymentProvider.ManualGCash,
                PaymentMethod = "GCash",
                Amount = 1000.00m,
                Status = PaymentStatus.Success,
                CreatedAt = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
            logger?.LogInformation("QA Test Data: Successfully seeded order #110626-922 (Sam Sam).");
        }
    }

    private static async Task SeedCustomerProfilesAsync(LechonDbContext context)
    {
        // 1. Elena Gomez (Complaint + Preference Test)
        var elena = await context.CustomerProfiles.FirstOrDefaultAsync(c => c.ContactNumber == "09171112222");
        if (elena == null)
        {
            context.CustomerProfiles.Add(new CustomerProfile
            {
                ContactNumber = "09171112222",
                FullName = "Elena Gomez",
                FacebookName = "Elena Gomez-Reyes",
                DefaultAddress = "Blk 4 Lot 12 Phase 2, Golden City, Imus, Cavite",
                DefaultLandmark = "Tapat ng St. Jude Chapel, green gate",
                Preferences = "Always requests extra liver sauce and crispy balat. No dinuguan.",
                ComplaintHistory = "Oct 10, 2026: Reported rib section was slightly undercooked and rider arrived 15 mins late. Ensure thorough temp check before dispatch.",
                IsVip = true,
                TotalOrdersCount = 3,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            elena.FullName = "Elena Gomez";
            elena.FacebookName = "Elena Gomez-Reyes";
            elena.DefaultAddress = "Blk 4 Lot 12 Phase 2, Golden City, Imus, Cavite";
            elena.DefaultLandmark = "Tapat ng St. Jude Chapel, green gate";
            elena.Preferences = "Always requests extra liver sauce and crispy balat. No dinuguan.";
            elena.ComplaintHistory = "Oct 10, 2026: Reported rib section was slightly undercooked and rider arrived 15 mins late. Ensure thorough temp check before dispatch.";
            elena.IsVip = true;
            elena.TotalOrdersCount = 3;
            elena.UpdatedAt = DateTime.UtcNow;
        }

        // 2. Carding Dalisay (Preference Only + Store Pickup Test)
        var carding = await context.CustomerProfiles.FirstOrDefaultAsync(c => c.ContactNumber == "09182223333");
        if (carding == null)
        {
            context.CustomerProfiles.Add(new CustomerProfile
            {
                ContactNumber = "09182223333",
                FullName = "Carding Dalisay",
                FacebookName = "Ricardo Dalisay Official",
                DefaultAddress = "Poblacion 1-A, Imus, Cavite",
                DefaultLandmark = "Near Imus Cathedral",
                Preferences = "Prefers lechon belly chopped and packed separately in foil tray.",
                ComplaintHistory = null,
                IsVip = true,
                TotalOrdersCount = 2,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            carding.FullName = "Carding Dalisay";
            carding.FacebookName = "Ricardo Dalisay Official";
            carding.DefaultAddress = "Poblacion 1-A, Imus, Cavite";
            carding.DefaultLandmark = "Near Imus Cathedral";
            carding.Preferences = "Prefers lechon belly chopped and packed separately in foil tray.";
            carding.ComplaintHistory = null;
            carding.IsVip = true;
            carding.TotalOrdersCount = 2;
            carding.UpdatedAt = DateTime.UtcNow;
        }

        // 3. Marco Polo (Long-Distance >35km 2-Hour Departure Test)
        var marco = await context.CustomerProfiles.FirstOrDefaultAsync(c => c.ContactNumber == "09193334444");
        if (marco == null)
        {
            context.CustomerProfiles.Add(new CustomerProfile
            {
                ContactNumber = "09193334444",
                FullName = "Marco Polo",
                FacebookName = "Marco Polo Tagaytay",
                DefaultAddress = "Mahogany Ave, Tagaytay City, Cavite",
                DefaultLandmark = "Beside Tagaytay Rotonda 7-Eleven",
                Preferences = "Calls 30 minutes before rider arrival.",
                ComplaintHistory = null,
                IsVip = false,
                TotalOrdersCount = 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            marco.FullName = "Marco Polo";
            marco.FacebookName = "Marco Polo Tagaytay";
            marco.DefaultAddress = "Mahogany Ave, Tagaytay City, Cavite";
            marco.DefaultLandmark = "Beside Tagaytay Rotonda 7-Eleven";
            marco.Preferences = "Calls 30 minutes before rider arrival.";
            marco.ComplaintHistory = null;
            marco.IsVip = false;
            marco.TotalOrdersCount = 1;
            marco.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }
}
