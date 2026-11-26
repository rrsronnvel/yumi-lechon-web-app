using System.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

internal static class November25QaDataSeed
{
    private static readonly DateTime CreatedAt = new(2026, 11, 25, 4, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime PeakTarget = new(2026, 12, 24, 10, 0, 0);

    private static readonly Fixture[] Fixtures =
    [
        new("112626-901", "Rosemarie Pedroza (2x Jumbo QA)", "Jumbo", 2, 16500m,
            new DateTime(2026, 11, 26, 16, 0, 0), FulfillmentType.Delivery, 430m, 2000m, 1000m, "GCash", "ORDER_DP_QA_901"),
        new("112626-902", "Jessy Tayone (Draft DP QA)", "Jumbo", 1, 16500m,
            null, FulfillmentType.Pickup, Downpayment: 1000m, PaymentMethod: "Cash", PaymentReference: "ORDER_DP_QA_902"),
        new("112626-903", "Split Moto Rider QA (3x M)", "M", 3, 12700m,
            new DateTime(2026, 11, 26, 14, 0, 0), FulfillmentType.Delivery, 500m,
            Downpayment: 5000m, PaymentMethod: "GCash", PaymentReference: "ORDER_DP_QA_903",
            LeadRider: "Adrianne", SupportRider: "Randy"),
        new("122426-910", "Dec 24 Batch 2 Whole Lechon QA", "M", 12, 12700m,
            PeakTarget, FulfillmentType.Pickup, BatchCode: "PEAK_B2"),
        new("122426-911", "Dec 24 Batch 2 Belly QA", "Belly 3kg", 3, 2500m,
            PeakTarget, FulfillmentType.Pickup, BatchCode: "PEAK_B2")
    ];

    public static async Task SeedAsync(LechonDbContext context, ISchedulingService scheduling)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var references = Fixtures.Select(fixture => fixture.Reference).ToArray();
        var existingReferences = await context.Orders.Where(order => references.Contains(order.OrderReference))
            .Select(order => order.OrderReference).ToListAsync();
        var missing = Fixtures.Where(fixture => !existingReferences.Contains(fixture.Reference)).ToList();
        var names = missing.Select(fixture => fixture.Category).ToArray();
        var categories = await context.ItemCategories.Where(category => names.Contains(category.Name))
            .ToDictionaryAsync(category => category.Name);

        foreach (var fixture in missing)
        {
            var category = categories[fixture.Category];
            var amount = fixture.UnitPrice * fixture.Quantity;
            var order = new Order
            {
                OrderReference = fixture.Reference,
                CustomerName = fixture.Customer,
                Source = "Development QA",
                EventType = "Kitchen capacity QA",
                CreatedBy = "System QA Seed Nov 25",
                CreatedAt = CreatedAt,
                IsDraft = !fixture.Target.HasValue,
                IsTimeTbd = !fixture.Target.HasValue,
                TargetDeliveryTime = fixture.Target,
                RiderDepartureTime = fixture.Fulfillment == FulfillmentType.Delivery ? fixture.Target?.AddHours(-1) : fixture.Target,
                Fulfillment = fixture.Fulfillment,
                DeliveryAddress = fixture.Fulfillment == FulfillmentType.Delivery ? "Carmona, Cavite" : null,
                KitchenBranch = "CARMONA",
                KitchenBatchCode = fixture.BatchCode,
                Price = amount,
                DeliveryFee = fixture.DeliveryFee,
                Discount = fixture.Discount,
                GrandTotal = amount - fixture.Discount + fixture.DeliveryFee,
                Downpayment = fixture.Downpayment,
                DownpaymentMethod = fixture.PaymentMethod
            };
            var item = new OrderItem
            {
                Order = order,
                ItemCategoryId = category.Id,
                Quantity = fixture.Quantity,
                Price = fixture.UnitPrice,
                TotalPrice = amount,
                CreatedAt = CreatedAt
            };
            if (fixture.LeadRider != null)
            {
                order.DeliveryTrip = new DeliveryTrip
                {
                    RiderName = fixture.LeadRider,
                    VehicleType = "Motorcycle",
                    Status = DeliveryStatus.Assigned,
                    DispatchTime = order.RiderDepartureTime,
                    CreatedAt = CreatedAt
                };
                order.RoutingStatus = DeliveryStatus.Assigned;
                order.SupportRiderName = fixture.SupportRider;
                order.SupportRiderFee = fixture.DeliveryFee;
                order.SupportRiderHeads = 1;
            }
            order.OrderItems.Add(item);
            context.Orders.Add(order);
            if (!order.IsDraft)
            {
                await scheduling.SynchronizeItemSchedulesAsync(item, order, category);
                if (fixture.LeadRider != null)
                {
                    foreach (var schedule in item.OrderItemSchedules)
                    {
                        schedule.AssignedRiderName = schedule.UnitIndex == fixture.Quantity ? fixture.SupportRider : fixture.LeadRider;
                    }
                }
            }

            if (fixture.PaymentReference != null)
            {
                context.PaymentLogs.Add(new PaymentLog
                {
                    Order = order,
                    GatewayReferenceId = fixture.PaymentReference,
                    Amount = fixture.Downpayment,
                    PaymentMethod = fixture.PaymentMethod,
                    Provider = PaymentChannels.ToProvider(fixture.PaymentMethod),
                    Status = PaymentStatus.Success,
                    RecordedBy = order.CreatedBy,
                    CreatedAt = CreatedAt
                });
            }
        }

        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    private sealed record Fixture(string Reference, string Customer, string Category, int Quantity, decimal UnitPrice,
        DateTime? Target, FulfillmentType Fulfillment, decimal DeliveryFee = 0m, decimal Discount = 0m,
        decimal Downpayment = 0m, string PaymentMethod = "None", string? PaymentReference = null, string? BatchCode = null,
        string? LeadRider = null, string? SupportRider = null);
}
