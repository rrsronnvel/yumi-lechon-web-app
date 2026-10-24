using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;

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

        var refPrefix = DateTime.UtcNow.ToString("MMddyy");
        var refA = $"{refPrefix}-901";
        var refB = $"{refPrefix}-902";
        var refC = $"{refPrefix}-903";

        // 2. Clean up old test orders with references starting with "QA-" or matching previous test batch
        var oldOrders = await context.Orders
            .Include(o => o.OrderItems)
            .Where(o => o.OrderReference.StartsWith("QA-") ||
                        o.OrderReference.EndsWith("-901") ||
                        o.OrderReference.EndsWith("-902") ||
                        o.OrderReference.EndsWith("-903") ||
                        o.OrderReference == "102126-001" ||
                        o.OrderReference == "102126-002" ||
                        o.OrderReference == "102126-003" ||
                        o.CustomerName.Contains("(Finding 3 Test)") ||
                        o.CustomerName.Contains("(38km Long Haul)") ||
                        o.CustomerName.Contains("(Pickup Anchor)"))
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

        logger?.LogInformation("QA Test Data: Seeding dynamic clock test orders ({RefA}, {RefB}, {RefC})...", refA, refB, refC);

        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);

        // =========================================================================
        // Order A (Today's Afternoon Delivery - 12 KM / 1hr Departure Lead Time)
        // =========================================================================
        var orderA = new Order
        {
            OrderReference = refA,
            CustomerName = "Elena Gomez (Finding 3 Test)",
            FacebookName = "Elena Gomez-Reyes",
            ContactNumber = "09171112222",
            Source = "Business FB Page",
            EventType = "Birthday",
            Fulfillment = FulfillmentType.Delivery,
            TargetDeliveryTime = today.AddHours(17), // Today at 5:00 PM
            RiderDepartureTime = today.AddHours(16), // Today at 4:00 PM (1 hr lead time)
            DeliveryAddress = "Blk 4 Lot 12 Phase 2, Golden City, Imus, Cavite",
            Landmark = "Tapat ng St. Jude Chapel, green gate",
            Remarks = "Walang dinuguan, print shoutout: Happy Birthday!",
            DeliveryFee = 280.00m, // 100 base + 12km * 15
            Downpayment = 3000.00m,
            DownpaymentMethod = "GCash",
            Discount = 0.00m,
            Price = 12700.00m,
            GrandTotal = 12980.00m,
            IsTrustedCustomer = true,
            IsDeliveryDetailsConfirmed = false,
            SettlementCustodyStatus = "Uncollected",
            RoutingStatus = DeliveryStatus.Unassigned,
            CreatedBy = "QA Seeder",
            CreatedAt = DateTime.UtcNow
        };

        var orderAItem = new OrderItem
        {
            ItemCategoryId = 4, // Medium Whole Lechon (12,700)
            Quantity = 1,
            Price = 12700.00m,
            TotalPrice = 12700.00m,
            CreatedAt = DateTime.UtcNow
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
            CreatedAt = DateTime.UtcNow
        });

        context.OrderAuditLogs.Add(new OrderAuditLog
        {
            OrderId = orderA.Id,
            ActionType = "Order Created",
            Changes = $"Order #{orderA.OrderReference} created for {orderA.CustomerName} (Total: ₱{orderA.GrandTotal:N2})",
            ChangedBy = "QA Seeder",
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });

        // =========================================================================
        // Order B (Tomorrow's Long Distance - 38 KM / 2hr Departure Lead Time)
        // =========================================================================
        var orderB = new Order
        {
            OrderReference = refB,
            CustomerName = "Marco Polo (38km Long Haul)",
            FacebookName = "Marco Polo Tagaytay",
            ContactNumber = "09193334444",
            Source = "Business FB Page",
            EventType = "Anniversary",
            Fulfillment = FulfillmentType.Delivery,
            TargetDeliveryTime = tomorrow.AddHours(13), // Tomorrow at 1:00 PM
            RiderDepartureTime = tomorrow.AddHours(11), // Tomorrow at 11:00 AM (2 hrs lead time)
            DeliveryAddress = "Mahogany Ave, Tagaytay City, Cavite",
            Landmark = "Beside Tagaytay Rotonda 7-Eleven",
            Remarks = "Extra crispy skin, call 30 mins before arrival",
            DeliveryFee = 670.00m, // 100 base + 38km * 15
            Downpayment = 5000.00m,
            DownpaymentMethod = "GCash",
            Discount = 0.00m,
            Price = 11000.00m,
            GrandTotal = 11670.00m,
            IsTrustedCustomer = false,
            IsDeliveryDetailsConfirmed = false,
            SettlementCustodyStatus = "Uncollected",
            RoutingStatus = DeliveryStatus.Unassigned,
            CreatedBy = "QA Seeder",
            CreatedAt = DateTime.UtcNow
        };

        var orderBItem = new OrderItem
        {
            ItemCategoryId = 2, // Extra Small Whole Lechon (11,000)
            Quantity = 1,
            Price = 11000.00m,
            TotalPrice = 11000.00m,
            CreatedAt = DateTime.UtcNow
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
        // Explicitly align with QA Finding 3 Anchor Verification specifications:
        // Anchored to RiderDepartureTime (11:00 AM) -> Packaging: 10:30 AM, Salang: 08:30 AM, Tahi: 07:30 AM
        scheduleB.PackagingStartTime = tomorrow.AddHours(10).AddMinutes(30);
        scheduleB.SalangStartTime = tomorrow.AddHours(8).AddMinutes(30);
        scheduleB.TahiStartTime = tomorrow.AddHours(7).AddMinutes(30);
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
            CreatedAt = DateTime.UtcNow
        });

        context.OrderAuditLogs.Add(new OrderAuditLog
        {
            OrderId = orderB.Id,
            ActionType = "Order Created",
            Changes = $"Order #{orderB.OrderReference} created for {orderB.CustomerName} (Total: ₱{orderB.GrandTotal:N2})",
            ChangedBy = "QA Seeder",
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });

        // =========================================================================
        // Order C (Tomorrow's Store Pickup - Departure Locked to Pickup Time)
        // =========================================================================
        var orderC = new Order
        {
            OrderReference = refC,
            CustomerName = "Carding Dalisay (Pickup Anchor)",
            FacebookName = "Ricardo Dalisay Official",
            ContactNumber = "09182223333",
            Source = "Personal FB Account",
            EventType = "Binyag",
            Fulfillment = FulfillmentType.Pickup,
            TargetDeliveryTime = tomorrow.AddHours(15), // Tomorrow at 3:00 PM
            RiderDepartureTime = tomorrow.AddHours(15), // Tomorrow at 3:00 PM (Locked to TargetDeliveryTime)
            DeliveryAddress = "Poblacion 1-A, Imus, Cavite",
            Landmark = "Near Imus Cathedral (Walk-in Store Pickup)",
            Remarks = "Chop belly separately in foil tray",
            DeliveryFee = 0.00m,
            Downpayment = 2000.00m,
            DownpaymentMethod = "Cash",
            Discount = 0.00m,
            Price = 12000.00m,
            GrandTotal = 12000.00m,
            IsTrustedCustomer = true,
            IsDeliveryDetailsConfirmed = false,
            SettlementCustodyStatus = "Uncollected",
            RoutingStatus = DeliveryStatus.Unassigned,
            CreatedBy = "QA Seeder",
            CreatedAt = DateTime.UtcNow
        };

        var orderCItem = new OrderItem
        {
            ItemCategoryId = 3, // Small Whole Lechon (12,000)
            Quantity = 1,
            Price = 12000.00m,
            TotalPrice = 12000.00m,
            CreatedAt = DateTime.UtcNow
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
            Provider = PaymentProvider.Cash,
            PaymentMethod = "Cash",
            Amount = orderC.Downpayment,
            Status = PaymentStatus.Success,
            CreatedAt = DateTime.UtcNow
        });

        context.OrderAuditLogs.Add(new OrderAuditLog
        {
            OrderId = orderC.Id,
            ActionType = "Order Created",
            Changes = $"Order #{orderC.OrderReference} created for {orderC.CustomerName} (Total: ₱{orderC.GrandTotal:N2})",
            ChangedBy = "QA Seeder",
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();
        logger?.LogInformation("QA Test Data: Successfully seeded Finding 3 dynamic orders ({RefA}, {RefB}, {RefC}).", refA, refB, refC);
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
