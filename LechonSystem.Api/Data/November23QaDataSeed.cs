using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

/// <summary>
/// Non-destructive, development-only QA fixtures for the November 23 Manifest & Mobile fixes.
/// Includes:
/// 1. #112326-901: Jason Canete (Staggered 3-installment Walk-in DP QA)
/// 2. #112326-902: Leah de Guzman (Voided DP + Reassigned Rider Adrianne Net Remittance QA)
/// </summary>
public static class November23QaDataSeed
{
    private static readonly DateTime QaSeedTimestampUtc = new(2026, 11, 23, 0, 0, 0, DateTimeKind.Utc);

    public static async Task SeedAsync(LechonDbContext context, CancellationToken cancellationToken = default)
    {
        var mediumCategory = await context.ItemCategories
            .FirstOrDefaultAsync(c => c.Name == "M", cancellationToken);

        if (mediumCategory == null)
        {
            throw new InvalidOperationException("Cannot seed November 23 QA data: item category 'M' was not found.");
        }

        await EnsureJasonCaneteInstallmentOrderAsync(context, mediumCategory, cancellationToken);
        await EnsureLeahDeGuzmanNetRemitOrderAsync(context, mediumCategory, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureJasonCaneteInstallmentOrderAsync(
        LechonDbContext context,
        ItemCategory mediumCategory,
        CancellationToken cancellationToken)
    {
        var target = new DateTime(2026, 12, 31, 15, 0, 0);
        var order = await context.Orders
            .Include(existing => existing.OrderItems)
            .FirstOrDefaultAsync(existing => existing.OrderReference == "112326-901", cancellationToken);

        if (order == null)
        {
            order = new Order { OrderReference = "112326-901" };
            context.Orders.Add(order);
        }

        order.CustomerName = "Jason Canete (Installment DP QA)";
        order.FacebookName = "Jason Canete";
        order.ContactNumber = "09171123901";
        order.Source = "Walk-in";
        order.EventType = "Daily Ops QA";
        order.IsDraft = false;
        order.IsTimeTbd = false;
        order.Fulfillment = FulfillmentType.Delivery;
        order.TargetDeliveryTime = target;
        order.RiderDepartureTime = target.AddHours(-1);
        order.DeliveryAddress = "Walk-in Customer Delivery Address, Imus, Cavite";
        order.Remarks = "Development QA: 3 staggered installment downpayments (GCash + Cash).";
        order.Price = 12700.00m;
        order.Discount = 1000.00m;
        order.DeliveryFee = 265.00m;
        order.GrandTotal = 11965.00m;
        order.Downpayment = 6500.00m;
        order.DownpaymentMethod = "Split (GCash + Cash)";
        order.IsDpRemittedToOwner = false;
        order.DpRemittedAt = null;
        order.DpRemittedBy = null;
        order.FreebiesSummary = "Standard 7 Freebies";
        order.FreebiesConfigJson = "{\"optOut\":false,\"pigsWithFreebies\":1,\"rawInnards\":false,\"counts\":{\"Sarsa\":1,\"1.5L Coke\":1,\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Dinuguan\":1,\"Puto\":1},\"bellyCounts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0}}";
        order.IsTrustedCustomer = false;
        order.IsDeliveryDetailsConfirmed = true;
        order.IsCancelled = false;
        order.CancellationReason = null;
        order.IsPriceWaived = false;
        order.CreatedBy = "System QA Seed Nov 23";
        order.RoutingStatus = DeliveryStatus.Unassigned;
        order.SettlementCustodyStatus = "Uncollected";
        order.HeldByStaffMethod = null;
        order.HeldByStaffAmount = null;
        order.RiderRemittedAmount = null;
        if (order.CreatedAt == default) order.CreatedAt = QaSeedTimestampUtc;
        order.UpdatedAt = QaSeedTimestampUtc;

        await context.SaveChangesAsync(cancellationToken);

        var item = order.OrderItems.FirstOrDefault(existing => existing.ItemCategoryId == mediumCategory.Id);
        if (item == null)
        {
            item = new OrderItem
            {
                OrderId = order.Id,
                ItemCategoryId = mediumCategory.Id,
                CreatedAt = QaSeedTimestampUtc
            };
            order.OrderItems.Add(item);
        }

        item.Quantity = 1;
        item.Price = 12700.00m;
        item.TotalPrice = 12700.00m;
        await context.SaveChangesAsync(cancellationToken);

        // 3 Separate Payment Logs for #112326-901:
        // Log 1 (2026-11-13): ₱1,500 GCash
        await EnsurePaymentAsync(
            context,
            order.Id,
            "ORDER_DP_QA_901_1",
            "GCash",
            1500.00m,
            new DateTime(2026, 11, 13, 10, 0, 0, DateTimeKind.Utc),
            isVoided: false,
            isRemitted: false,
            cancellationToken);

        // Log 2 (2026-11-15): ₱2,000 Cash
        await EnsurePaymentAsync(
            context,
            order.Id,
            "MANUAL_QA_901_2",
            "Cash",
            2000.00m,
            new DateTime(2026, 11, 15, 14, 0, 0, DateTimeKind.Utc),
            isVoided: false,
            isRemitted: false,
            cancellationToken);

        // Log 3 (2026-11-20): ₱3,000 Cash
        await EnsurePaymentAsync(
            context,
            order.Id,
            "MANUAL_QA_901_3",
            "Cash",
            3000.00m,
            new DateTime(2026, 11, 20, 11, 0, 0, DateTimeKind.Utc),
            isVoided: false,
            isRemitted: false,
            cancellationToken);
    }

    private static async Task EnsureLeahDeGuzmanNetRemitOrderAsync(
        LechonDbContext context,
        ItemCategory mediumCategory,
        CancellationToken cancellationToken)
    {
        var target = new DateTime(2026, 11, 23, 16, 0, 0);
        var departure = new DateTime(2026, 11, 23, 15, 0, 0);

        await RiderRegistrationHelper.EnsureRiderRegisteredAsync(context, "Adrianne");

        var trip = await context.DeliveryTrips
            .Include(t => t.Orders)
            .FirstOrDefaultAsync(t => t.RiderName == "Adrianne" && t.Status == DeliveryStatus.Assigned, cancellationToken);

        if (trip == null)
        {
            trip = new DeliveryTrip
            {
                RiderName = "Adrianne",
                VehicleType = "Motorcycle",
                Status = DeliveryStatus.Assigned,
                DispatchTime = DateTime.UtcNow
            };
            context.DeliveryTrips.Add(trip);
            await context.SaveChangesAsync(cancellationToken);
        }

        var order = await context.Orders
            .Include(existing => existing.OrderItems)
            .FirstOrDefaultAsync(existing => existing.OrderReference == "112326-902", cancellationToken);

        if (order == null)
        {
            order = new Order { OrderReference = "112326-902" };
            context.Orders.Add(order);
        }

        order.CustomerName = "Leah de Guzman (Net Remit QA)";
        order.FacebookName = "Leah de Guzman";
        order.ContactNumber = "09171123902";
        order.Source = "Messenger";
        order.EventType = "Daily Ops QA";
        order.IsDraft = false;
        order.IsTimeTbd = false;
        order.Fulfillment = FulfillmentType.Delivery;
        order.TargetDeliveryTime = target;
        order.RiderDepartureTime = departure;
        order.DeliveryAddress = "123 General Trias, Cavite";
        order.Remarks = "Development QA: Voided ₱1 DP + ₱1,000 active DP, reassigned rider Adrianne, net remittance = ₱11,700.";
        order.Price = 12700.00m;
        order.Discount = 0m;
        order.DeliveryFee = 520.00m;
        order.GrandTotal = 13220.00m;
        order.Downpayment = 1000.00m;
        order.DownpaymentMethod = "GCash";
        order.IsDpRemittedToOwner = false;
        order.DpRemittedAt = null;
        order.DpRemittedBy = null;
        order.FreebiesSummary = "Standard 7 Freebies";
        order.FreebiesConfigJson = "{\"optOut\":false,\"pigsWithFreebies\":1,\"rawInnards\":false,\"counts\":{\"Sarsa\":1,\"1.5L Coke\":1,\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Dinuguan\":1,\"Puto\":1},\"bellyCounts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0}}";
        order.IsTrustedCustomer = false;
        order.IsDeliveryDetailsConfirmed = true;
        order.IsCancelled = false;
        order.CancellationReason = null;
        order.IsPriceWaived = false;
        order.CreatedBy = "System QA Seed Nov 23";
        order.RoutingStatus = DeliveryStatus.Assigned;
        order.SettlementCustodyStatus = "Uncollected";
        order.HeldByStaffMethod = null;
        order.HeldByStaffAmount = null; // Strictly null!
        order.RiderRemittedAmount = null; // Strictly null!
        order.RiderSignedBy = null;
        order.DeliveryTripId = trip.Id;
        order.DeliveryTrip = trip;
        if (order.CreatedAt == default) order.CreatedAt = QaSeedTimestampUtc;
        order.UpdatedAt = QaSeedTimestampUtc;

        await context.SaveChangesAsync(cancellationToken);

        var item = order.OrderItems.FirstOrDefault(existing => existing.ItemCategoryId == mediumCategory.Id);
        if (item == null)
        {
            item = new OrderItem
            {
                OrderId = order.Id,
                ItemCategoryId = mediumCategory.Id,
                CreatedAt = QaSeedTimestampUtc
            };
            order.OrderItems.Add(item);
        }

        item.Quantity = 1;
        item.Price = 12700.00m;
        item.TotalPrice = 12700.00m;
        await context.SaveChangesAsync(cancellationToken);

        // Payment Log 1: Voided ₱1 GCash
        await EnsurePaymentAsync(
            context,
            order.Id,
            "QA-112326-902-VOID",
            "GCash",
            1.00m,
            new DateTime(2026, 11, 16, 9, 0, 0, DateTimeKind.Utc),
            isVoided: true,
            isRemitted: false,
            cancellationToken,
            voidReason: "Voided initial deposit",
            voidedAt: new DateTime(2026, 11, 16, 9, 30, 0, DateTimeKind.Utc),
            voidedBy: "System QA Seed");

        // Payment Log 2: Active ₱1,000 GCash
        await EnsurePaymentAsync(
            context,
            order.Id,
            "QA-112326-902-DP",
            "GCash",
            1000.00m,
            new DateTime(2026, 11, 16, 10, 0, 0, DateTimeKind.Utc),
            isVoided: false,
            isRemitted: false,
            cancellationToken);
    }

    private static async Task EnsurePaymentAsync(
        LechonDbContext context,
        int orderId,
        string reference,
        string paymentMethod,
        decimal amount,
        DateTime createdAt,
        bool isVoided,
        bool isRemitted,
        CancellationToken cancellationToken,
        string? voidReason = null,
        DateTime? voidedAt = null,
        string? voidedBy = null)
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
        payment.RecordedBy = "System QA Seed Nov 23";
        payment.IsVoided = isVoided;
        payment.VoidedAt = voidedAt;
        payment.VoidedBy = voidedBy;
        payment.VoidReason = voidReason;
        payment.IsRemittedToOwner = isRemitted;
        payment.RemittedAt = isRemitted ? createdAt : null;
        payment.RemittedBy = isRemitted ? "System QA Seed Nov 23" : null;
        payment.CreatedAt = createdAt;
    }
}
