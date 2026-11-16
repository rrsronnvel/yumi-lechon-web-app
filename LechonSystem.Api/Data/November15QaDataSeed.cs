using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

/// <summary>
/// Non-destructive, development-only QA fixtures for the November 15 daily-ops fixes.
/// The caller is responsible for enforcing the Development environment guard.
/// </summary>
public static class November15QaDataSeed
{
    private static readonly DateTime QaCreatedAtUtc = new(2026, 11, 15, 0, 0, 0, DateTimeKind.Utc);

    public static async Task SeedAsync(LechonDbContext context, CancellationToken cancellationToken = default)
    {
        var categoryNames = new[] { "M", "Belly 5kg", "Sarsa" };
        var categories = await context.ItemCategories
            .Where(category => categoryNames.Contains(category.Name))
            .ToDictionaryAsync(category => category.Name, cancellationToken);

        foreach (var categoryName in categoryNames)
        {
            if (!categories.ContainsKey(categoryName))
            {
                throw new InvalidOperationException($"Cannot seed November 15 QA data: item category '{categoryName}' was not found.");
            }
        }

        await EnsureMorningOrderAsync(context, categories["M"], cancellationToken);
        await EnsureAfternoonOrderAsync(context, categories["Belly 5kg"], categories["Sarsa"], cancellationToken);
        await EnsureAfternoonPalutoAsync(context, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureMorningOrderAsync(
        LechonDbContext context,
        ItemCategory mediumCategory,
        CancellationToken cancellationToken)
    {
        var target = new DateTime(2026, 11, 15, 10, 0, 0);
        var order = await context.Orders
            .Include(existing => existing.OrderItems)
            .FirstOrDefaultAsync(existing => existing.OrderReference == "111526-901", cancellationToken);

        if (order == null)
        {
            order = new Order { OrderReference = "111526-901" };
            context.Orders.Add(order);
        }

        order.CustomerName = "Morning Shift QA (10AM Prep & StockOut)";
        order.FacebookName = "Morning Shift QA";
        order.ContactNumber = "09171110901";
        order.Source = "System QA Seed";
        order.EventType = "Daily Ops QA";
        order.IsDraft = false;
        order.IsTimeTbd = false;
        order.Fulfillment = FulfillmentType.Pickup;
        order.TargetDeliveryTime = target;
        order.RiderDepartureTime = target;
        order.DeliveryAddress = "Store Pickup Counter";
        order.Remarks = "Development QA: morning prep split and automatic inventory StockOut.";
        order.Price = 12700.00m;
        order.AddOns = null;
        order.DeliveryFee = 0m;
        order.Downpayment = 3000.00m;
        order.DownpaymentMethod = "Cash";
        order.IsDpRemittedToOwner = true;
        order.DpRemittedAt = target;
        order.DpRemittedBy = "System QA Seed";
        order.FreebiesSummary = "Standard 7 Freebies";
        order.FreebiesConfigJson = "{\"optOut\":false,\"pigsWithFreebies\":1,\"rawInnards\":false,\"counts\":{\"Sarsa\":1,\"1.5L Coke\":1,\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Dinuguan\":1,\"Puto\":1},\"bellyCounts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0}}";
        order.Discount = 0m;
        order.GrandTotal = 12700.00m;
        order.IsTrustedCustomer = false;
        order.IsDeliveryDetailsConfirmed = true;
        order.IsCancelled = false;
        order.CancellationReason = null;
        order.IsPriceWaived = false;
        order.CreatedBy = "System QA Seed Nov 15";
        order.RoutingStatus = DeliveryStatus.Delivered;
        order.SettlementCustodyStatus = "Settled";
        order.HeldByStaffMethod = null;
        order.HeldByStaffAmount = 0m;
        order.OwnerApprovedBy = "System QA Seed";
        order.OwnerApprovedAt = target;
        if (order.CreatedAt == default) order.CreatedAt = QaCreatedAtUtc;
        order.UpdatedAt = QaCreatedAtUtc;

        await context.SaveChangesAsync(cancellationToken);

        var item = order.OrderItems.FirstOrDefault(existing => existing.ItemCategoryId == mediumCategory.Id);
        if (item == null)
        {
            item = new OrderItem
            {
                OrderId = order.Id,
                ItemCategoryId = mediumCategory.Id,
                CreatedAt = QaCreatedAtUtc
            };
            order.OrderItems.Add(item);
        }

        item.Quantity = 1;
        item.Price = 12700.00m;
        item.TotalPrice = 12700.00m;
        await context.SaveChangesAsync(cancellationToken);

        var schedule = await context.OrderItemSchedules
            .FirstOrDefaultAsync(existing => existing.OrderItemId == item.Id, cancellationToken);
        if (schedule == null)
        {
            schedule = new OrderItemSchedule
            {
                OrderItemId = item.Id,
                CreatedAt = QaCreatedAtUtc
            };
            context.OrderItemSchedules.Add(schedule);
        }

        schedule.TargetDeliveryTime = target;
        schedule.PackagingStartTime = new DateTime(2026, 11, 15, 9, 30, 0);
        schedule.SalangStartTime = new DateTime(2026, 11, 15, 6, 30, 0);
        schedule.TahiStartTime = new DateTime(2026, 11, 15, 5, 30, 0);
        schedule.IsManualOverride = false;
        schedule.CurrentStatus = ProductionStatus.ReadyForDelivery;

        await EnsurePaymentAsync(context, order.Id, "QA-111526-901-DP", "Cash", 3000.00m, target, cancellationToken);
    }

    private static async Task EnsureAfternoonOrderAsync(
        LechonDbContext context,
        ItemCategory bellyCategory,
        ItemCategory sarsaCategory,
        CancellationToken cancellationToken)
    {
        var target = new DateTime(2026, 11, 15, 14, 30, 0);
        var departure = new DateTime(2026, 11, 15, 14, 0, 0);
        var order = await context.Orders
            .Include(existing => existing.OrderItems)
            .FirstOrDefaultAsync(existing => existing.OrderReference == "111526-902", cancellationToken);

        if (order == null)
        {
            order = new Order { OrderReference = "111526-902" };
            context.Orders.Add(order);
        }

        order.CustomerName = "Afternoon Shift QA (2PM Prep)";
        order.FacebookName = "Afternoon Shift QA";
        order.ContactNumber = "09171110902";
        order.Source = "System QA Seed";
        order.EventType = "Daily Ops QA";
        order.IsDraft = false;
        order.IsTimeTbd = false;
        order.Fulfillment = FulfillmentType.Delivery;
        order.TargetDeliveryTime = target;
        order.RiderDepartureTime = departure;
        order.DeliveryAddress = "QA Freelance Delivery Route";
        order.Remarks = "Development QA: afternoon prep split, Belly 5kg freebie, and paid Extra Sarsa.";
        order.Price = 3800.00m;
        order.AddOns = "1x Extra Sarsa";
        order.DeliveryFee = 0m;
        order.Downpayment = 1000.00m;
        order.DownpaymentMethod = "GCash";
        order.IsDpRemittedToOwner = false;
        order.DpRemittedAt = null;
        order.DpRemittedBy = null;
        order.FreebiesSummary = "Belly Freebies: 1x Sarsa, 1x Palabok; Paid Add-On: 1x Extra Sarsa";
        order.FreebiesConfigJson = "{\"optOut\":false,\"pigsWithFreebies\":0,\"rawInnards\":false,\"counts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0},\"bellyCounts\":{\"Sarsa\":1,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":1,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0},\"bellySignature\":\"5x1\"}";
        order.Discount = 0m;
        order.GrandTotal = 3800.00m;
        order.IsTrustedCustomer = false;
        order.IsDeliveryDetailsConfirmed = true;
        order.IsCancelled = false;
        order.CancellationReason = null;
        order.IsPriceWaived = false;
        order.CreatedBy = "System QA Seed Nov 15";
        order.RoutingStatus = DeliveryStatus.Unassigned;
        order.SettlementCustodyStatus = "Uncollected";
        order.HeldByStaffMethod = null;
        order.HeldByStaffAmount = 0m;
        if (order.CreatedAt == default) order.CreatedAt = QaCreatedAtUtc;
        order.UpdatedAt = QaCreatedAtUtc;

        await context.SaveChangesAsync(cancellationToken);

        var bellyItem = order.OrderItems.FirstOrDefault(existing => existing.ItemCategoryId == bellyCategory.Id);
        if (bellyItem == null)
        {
            bellyItem = new OrderItem
            {
                OrderId = order.Id,
                ItemCategoryId = bellyCategory.Id,
                CreatedAt = QaCreatedAtUtc
            };
            order.OrderItems.Add(bellyItem);
        }
        bellyItem.Quantity = 1;
        bellyItem.Price = 3650.00m;
        bellyItem.TotalPrice = 3650.00m;

        var sarsaItem = order.OrderItems.FirstOrDefault(existing => existing.ItemCategoryId == sarsaCategory.Id);
        if (sarsaItem == null)
        {
            sarsaItem = new OrderItem
            {
                OrderId = order.Id,
                ItemCategoryId = sarsaCategory.Id,
                CreatedAt = QaCreatedAtUtc
            };
            order.OrderItems.Add(sarsaItem);
        }
        sarsaItem.Quantity = 1;
        sarsaItem.Price = 150.00m;
        sarsaItem.TotalPrice = 150.00m;
        await context.SaveChangesAsync(cancellationToken);

        var schedule = await context.OrderItemSchedules
            .FirstOrDefaultAsync(existing => existing.OrderItemId == bellyItem.Id, cancellationToken);
        if (schedule == null)
        {
            schedule = new OrderItemSchedule
            {
                OrderItemId = bellyItem.Id,
                CreatedAt = QaCreatedAtUtc
            };
            context.OrderItemSchedules.Add(schedule);
        }

        schedule.TargetDeliveryTime = target;
        schedule.PackagingStartTime = new DateTime(2026, 11, 15, 13, 45, 0);
        schedule.SalangStartTime = new DateTime(2026, 11, 15, 11, 30, 0);
        schedule.TahiStartTime = new DateTime(2026, 11, 15, 11, 0, 0);
        schedule.IsManualOverride = false;
        schedule.CurrentStatus = ProductionStatus.Defrosting;

        await EnsurePaymentAsync(context, order.Id, "QA-111526-902-DP", "GCash", 1000.00m, departure, cancellationToken);
    }

    private static async Task EnsureAfternoonPalutoAsync(LechonDbContext context, CancellationToken cancellationToken)
    {
        const string createdBy = "System QA Seed Nov 15";
        const string recipient = "Afternoon Crew Meryenda QA";
        var targetDate = new DateTime(2026, 11, 15);
        var targetTime = new DateTime(2026, 11, 15, 15, 30, 0);
        var prep = await context.KitchenPrepRequests.FirstOrDefaultAsync(
            existing => existing.TargetDate == targetDate &&
                        existing.RecipientOrLabel == recipient &&
                        existing.CreatedBy == createdBy,
            cancellationToken);

        if (prep == null)
        {
            prep = new KitchenPrepRequest();
            context.KitchenPrepRequests.Add(prep);
        }

        prep.TargetDate = targetDate;
        prep.TargetTime = targetTime;
        prep.Category = "Staff Meryenda";
        prep.RecipientOrLabel = recipient;
        prep.ItemsJson = "{\"Pancit\":2,\"Puto\":2,\"1.5L Coke\":2}";
        prep.Remarks = "Development QA: afternoon shift Store Paluto aggregation.";
        prep.CreatedBy = createdBy;
        if (prep.CreatedAt == default) prep.CreatedAt = QaCreatedAtUtc;
    }

    private static async Task EnsurePaymentAsync(
        LechonDbContext context,
        int orderId,
        string reference,
        string paymentMethod,
        decimal amount,
        DateTime createdAt,
        CancellationToken cancellationToken)
    {
        var payment = await context.PaymentLogs
            .FirstOrDefaultAsync(existing => existing.GatewayReferenceId == reference, cancellationToken);
        if (payment == null)
        {
            payment = new PaymentLog { GatewayReferenceId = reference };
            context.PaymentLogs.Add(payment);
        }

        payment.OrderId = orderId;
        payment.Provider = PaymentChannels.ToProvider(paymentMethod);
        payment.PaymentMethod = paymentMethod;
        payment.Amount = amount;
        payment.Status = PaymentStatus.Success;
        payment.RecordedBy = "System QA Seed";
        payment.IsVoided = false;
        payment.VoidedAt = null;
        payment.VoidedBy = null;
        payment.VoidReason = null;
        payment.CreatedAt = createdAt;
    }
}
