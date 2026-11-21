using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

/// <summary>
/// Insert-only Development fixtures for December promo and AM/PM Prep Sheet QA.
/// Reserved references are never updated, replaced, or deleted when already present.
/// </summary>
public static class December2026PromoQaSeed
{
    private static readonly DateTime CreatedAtUtc =
        new(2026, 11, 20, 0, 0, 0, DateTimeKind.Utc);

    public static async Task SeedAsync(
        LechonDbContext context,
        CancellationToken cancellationToken = default)
    {
        var definitions = new[]
        {
            new QaOrder(
                "120526-901", new DateTime(2026, 12, 5, 10, 0, 0), "M",
                "DEC_OPT1_PANCIT_BOPIS", "Option 1 – Pancit + Bopis",
                2000m, "GCash", 0m),
            new QaOrder(
                "120526-902", new DateTime(2026, 12, 5, 14, 0, 0), "L",
                "DEC_OPT2_SHANGHAI_DINUGUAN", "Option 2 – Shanghai + Dinuguan",
                2000m, "GCash", 0m),
            new QaOrder(
                "120526-903", new DateTime(2026, 12, 5, 15, 0, 0), "XL",
                "DEC_OPT3_LESS_2K", "Option 3 – ₱2,000 Cash Discount",
                0m, "None", 2000m),
            new QaOrder(
                "122426-901", new DateTime(2026, 12, 24, 11, 0, 0), "M",
                "DEC_PEAK_DINUGUAN", "Dec 24/31 – Dinuguan",
                0m, "None", 0m),
            new QaOrder(
                "122426-902", new DateTime(2026, 12, 24, 16, 0, 0), "L",
                "DEC_PEAK_BOPIS", "Dec 24/31 – Bopis",
                0m, "None", 0m)
        };

        var existingReferences = await context.Orders
            .AsNoTracking()
            .Where(order => definitions.Select(definition => definition.Reference)
                .Contains(order.OrderReference))
            .Select(order => order.OrderReference)
            .ToHashSetAsync(cancellationToken);

        var categoryNames = definitions.Select(definition => definition.CategoryName).Distinct().ToList();
        var categories = await context.ItemCategories
            .Where(category => categoryNames.Contains(category.Name))
            .ToDictionaryAsync(category => category.Name, cancellationToken);

        foreach (var definition in definitions)
        {
            if (existingReferences.Contains(definition.Reference))
            {
                continue;
            }

            if (!categories.TryGetValue(definition.CategoryName, out var category))
            {
                throw new InvalidOperationException(
                    $"Cannot seed December promo QA order: category '{definition.CategoryName}' was not found.");
            }

            var grandTotal = Math.Max(0m, category.BasePrice - definition.Discount);
            var order = new Order
            {
                OrderReference = definition.Reference,
                CustomerName = $"December Promo QA – {definition.PromoLabel}",
                FacebookName = "December Promo QA",
                ContactNumber = $"0917{definition.Reference.Replace("-", string.Empty)[..7]}",
                Source = "System QA Seed",
                EventType = "December Promo QA",
                IsDraft = false,
                IsTimeTbd = false,
                Fulfillment = FulfillmentType.Pickup,
                TargetDeliveryTime = definition.Target,
                RiderDepartureTime = definition.Target,
                DeliveryAddress = "Store Pickup Counter",
                Remarks = "Development-only December promotion and Prep Sheet fixture.",
                Price = category.BasePrice,
                DeliveryFee = 0m,
                Downpayment = definition.Downpayment,
                DownpaymentMethod = definition.DownpaymentMethod,
                FreebiesSummary = definition.PromoLabel,
                FreebiesConfigJson = definition.Discount > 0
                    ? "{\"optOut\":true,\"pigsWithFreebies\":0,\"rawInnards\":false,\"counts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0},\"bellyCounts\":{\"Sarsa\":0,\"1.5L Coke\":0,\"Pancit\":0,\"Palabok\":0,\"Spaghetti\":0,\"Dinuguan\":0,\"Puto\":0}}"
                    : null,
                PromoPackageCode = definition.PromoCode,
                PromoPackageLabel = definition.PromoLabel,
                Discount = definition.Discount,
                GrandTotal = grandTotal,
                IsOwnerConfirmed = true,
                OwnerConfirmedAt = CreatedAtUtc,
                OwnerConfirmedBy = "System QA Seed",
                IsDeliveryDetailsConfirmed = true,
                IsCancelled = false,
                IsPriceWaived = false,
                CreatedBy = "System QA Seed Dec 2026",
                RoutingStatus = DeliveryStatus.Unassigned,
                SettlementCustodyStatus = "Uncollected",
                CreatedAt = CreatedAtUtc,
                UpdatedAt = CreatedAtUtc
            };

            var item = new OrderItem
            {
                Order = order,
                ItemCategoryId = category.Id,
                Quantity = 1,
                Price = category.BasePrice,
                TotalPrice = category.BasePrice,
                CreatedAt = CreatedAtUtc,
                UpdatedAt = CreatedAtUtc
            };
            order.OrderItems.Add(item);

            var packagingMinutes = 30;
            var salangMinutes = category.Name == "XL" ? 210 : 180;
            var packaging = definition.Target.AddMinutes(-packagingMinutes);
            var salang = packaging.AddMinutes(-salangMinutes);
            context.OrderItemSchedules.Add(new OrderItemSchedule
            {
                OrderItem = item,
                TargetDeliveryTime = definition.Target,
                PackagingStartTime = packaging,
                SalangStartTime = salang,
                TahiStartTime = salang.AddMinutes(-60),
                IsManualOverride = false,
                CurrentStatus = ProductionStatus.Defrosting,
                CreatedAt = CreatedAtUtc,
                UpdatedAt = CreatedAtUtc
            });

            context.Orders.Add(order);

            if (definition.Downpayment > 0)
            {
                context.PaymentLogs.Add(new PaymentLog
                {
                    Order = order,
                    GatewayReferenceId = $"QA-{definition.Reference}-DP",
                    Provider = PaymentProvider.ManualGCash,
                    PaymentMethod = "GCash",
                    Amount = definition.Downpayment,
                    Status = PaymentStatus.Success,
                    RecordedBy = "System QA Seed",
                    IsVoided = false,
                    CreatedAt = CreatedAtUtc,
                    UpdatedAt = CreatedAtUtc
                });
            }
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    private sealed record QaOrder(
        string Reference,
        DateTime Target,
        string CategoryName,
        string PromoCode,
        string PromoLabel,
        decimal Downpayment,
        string DownpaymentMethod,
        decimal Discount);
}
