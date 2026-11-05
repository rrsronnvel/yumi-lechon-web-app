using LechonSystem.Api.Common;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public interface IReportService
{
    Task<ReportsAnalyticsDto> GetAnalyticsAsync(
        DateTime? startDate,
        DateTime? endDate,
        string? preset);
}

public class ReportService : IReportService
{
    private static readonly string[] LechonSizeOrder =
    [
        "XXS", "XS", "S", "M", "L", "XL", "XXL", "Jumbo", "S. Jumbo", "Belly Cuts"
    ];

    private readonly LechonDbContext _context;

    public ReportService(LechonDbContext context)
    {
        _context = context;
    }

    public async Task<ReportsAnalyticsDto> GetAnalyticsAsync(
        DateTime? startDate,
        DateTime? endDate,
        string? preset)
    {
        var (rangeStart, rangeEnd, normalizedPreset) = ResolveRange(startDate, endDate, preset);
        var exclusiveEnd = rangeEnd.AddDays(1);

        var orders = await _context.Orders
            .AsNoTracking()
            .Include(order => order.OrderItems)
                .ThenInclude(item => item.ItemCategory)
            .Include(order => order.OrderItems)
                .ThenInclude(item => item.FulfilledItemCategory)
            .Where(order => !order.IsDraft
                && order.TargetDeliveryTime.HasValue
                && order.TargetDeliveryTime.Value >= rangeStart
                && order.TargetDeliveryTime.Value < exclusiveEnd)
            .ToListAsync();

        var activeOrders = orders.Where(order => !order.IsCancelled).ToList();
        var activeOrderIds = activeOrders.Select(order => order.Id).ToList();
        var payments = activeOrderIds.Count == 0
            ? []
            : await _context.PaymentLogs
                .AsNoTracking()
                .Where(payment => activeOrderIds.Contains(payment.OrderId)
                    && payment.Status == PaymentStatus.Success
                    && !payment.IsVoided)
                .ToListAsync();

        var grossSales = activeOrders.Sum(GetOrderTotal);
        var completedOrders = activeOrders.Count(IsCompleted);
        var sizeRows = BuildSizeBreakdown(activeOrders);
        var adminRows = activeOrders
            .GroupBy(order => string.IsNullOrWhiteSpace(order.AssistedByAdmin)
                ? order.CreatedBy
                : order.AssistedByAdmin!)
            .Select(group => new AdminPerformanceRowDto
            {
                AdminName = string.IsNullOrWhiteSpace(group.Key) ? "System" : group.Key,
                TotalOrdersAssisted = group.Count(),
                TotalSalesGenerated = group.Sum(GetOrderTotal),
                CompletedOrdersCount = group.Count(IsCompleted)
            })
            .OrderByDescending(row => row.TotalSalesGenerated)
            .ThenBy(row => row.AdminName)
            .ToList();

        var paymentReport = BuildPaymentReport(activeOrders, payments, grossSales);

        return new ReportsAnalyticsDto
        {
            StartDate = rangeStart,
            EndDate = rangeEnd,
            Preset = normalizedPreset,
            OrderSummary = new OrderSummaryReportDto
            {
                TotalOrders = orders.Count,
                ConfirmedOrders = activeOrders.Count - completedOrders,
                CompletedOrders = completedOrders,
                CancelledOrders = orders.Count(order => order.IsCancelled),
                TotalGrossRevenue = grossSales,
                AverageOrderValue = activeOrders.Count == 0 ? 0 : grossSales / activeOrders.Count,
                LechonSizes = sizeRows
            },
            AdminPerformance = adminRows,
            PaymentCollection = paymentReport
        };
    }

    private static List<LechonSizeBreakdownDto> BuildSizeBreakdown(List<Order> orders)
    {
        var totals = LechonSizeOrder.ToDictionary(
            size => size,
            _ => (Count: 0, Revenue: 0m),
            StringComparer.OrdinalIgnoreCase);

        foreach (var item in orders.SelectMany(order => order.OrderItems))
        {
            var category = item.FulfilledItemCategory ?? item.ItemCategory;
            if (category == null || category.MinimumWeightKg <= 0) continue;

            var canonicalSize = category.Name.Contains("Belly", StringComparison.OrdinalIgnoreCase)
                ? "Belly Cuts"
                : NormalizeWholeLechonSize(category.Name);
            if (canonicalSize == null || !totals.ContainsKey(canonicalSize)) continue;

            var current = totals[canonicalSize];
            var lineRevenue = item.TotalPrice > 0
                ? item.TotalPrice
                : item.Price * item.Quantity;
            totals[canonicalSize] = (current.Count + item.Quantity, current.Revenue + lineRevenue);
        }

        return LechonSizeOrder.Select(size => new LechonSizeBreakdownDto
        {
            Size = size,
            Count = totals[size].Count,
            Revenue = totals[size].Revenue
        }).ToList();
    }

    private static PaymentCollectionReportDto BuildPaymentReport(
        List<Order> activeOrders,
        List<PaymentLog> payments,
        decimal grossSales)
    {
        var ordersById = activeOrders.ToDictionary(order => order.Id);
        decimal downpayments = 0;
        decimal handover = 0;
        decimal cash = 0;
        decimal gcash = 0;
        decimal maya = 0;
        decimal bankTransfer = 0;

        foreach (var payment in payments)
        {
            if (!ordersById.TryGetValue(payment.OrderId, out var order)) continue;
            var isInitialDownpayment = payment.CreatedAt <= order.CreatedAt.AddMinutes(30);
            if (isInitialDownpayment) downpayments += payment.Amount;
            else handover += payment.Amount;

            AddChannel(
                PaymentChannels.Normalize(payment.PaymentMethod, PaymentChannels.FromProvider(payment.Provider)),
                payment.Amount,
                ref cash,
                ref gcash,
                ref maya,
                ref bankTransfer);
        }

        foreach (var order in activeOrders.Where(order =>
                     order.SettlementCustodyStatus == "InStaffDrawer" &&
                     (order.HeldByStaffAmount ?? 0) > 0))
        {
            var heldAmount = order.HeldByStaffAmount ?? 0;
            handover += heldAmount;
            AddChannel(
                PaymentChannels.Normalize(order.HeldByStaffMethod),
                heldAmount,
                ref cash,
                ref gcash,
                ref maya,
                ref bankTransfer);
        }

        var totalCollected = activeOrders.Sum(order =>
        {
            var total = GetOrderTotal(order);
            var held = order.SettlementCustodyStatus == "InStaffDrawer"
                ? Math.Max(0, order.HeldByStaffAmount ?? 0)
                : 0;
            return Math.Min(total, Math.Max(0, order.Downpayment) + held);
        });

        return new PaymentCollectionReportDto
        {
            TotalGrossSales = grossSales,
            TotalDownpaymentCollected = downpayments,
            TotalCollectedAtHandover = handover,
            TotalCollected = totalCollected,
            TotalOutstandingBalance = activeOrders.Sum(order =>
            {
                var total = GetOrderTotal(order);
                var held = order.SettlementCustodyStatus == "InStaffDrawer"
                    ? Math.Max(0, order.HeldByStaffAmount ?? 0)
                    : 0;
                return Math.Max(0, total - order.Downpayment - held);
            }),
            PaymentChannels = new PaymentChannelBreakdownDto
            {
                Cash = cash,
                GCash = gcash,
                Maya = maya,
                BankTransfer = bankTransfer
            }
        };
    }

    private static void AddChannel(
        string channel,
        decimal amount,
        ref decimal cash,
        ref decimal gcash,
        ref decimal maya,
        ref decimal bankTransfer)
    {
        switch (channel)
        {
            case "GCash": gcash += amount; break;
            case "Maya": maya += amount; break;
            case "Bank Transfer": bankTransfer += amount; break;
            default: cash += amount; break;
        }
    }

    private static decimal GetOrderTotal(Order order) =>
        order.GrandTotal > 0
            ? order.GrandTotal
            : Math.Max(0, order.Price + order.DeliveryFee - order.Discount);

    private static bool IsCompleted(Order order) =>
        order.RoutingStatus == DeliveryStatus.Delivered ||
        string.Equals(order.SettlementCustodyStatus, "Settled", StringComparison.OrdinalIgnoreCase);

    private static string? NormalizeWholeLechonSize(string name)
    {
        var compact = name.Trim().Replace(" ", "", StringComparison.Ordinal).Replace(".", "", StringComparison.Ordinal);
        if (compact.Equals("SuperJumbo", StringComparison.OrdinalIgnoreCase) ||
            compact.Equals("SJumbo", StringComparison.OrdinalIgnoreCase)) return "S. Jumbo";
        return LechonSizeOrder.FirstOrDefault(size =>
            !size.Equals("Belly Cuts", StringComparison.OrdinalIgnoreCase) &&
            size.Replace(" ", "", StringComparison.Ordinal).Replace(".", "", StringComparison.Ordinal)
                .Equals(compact, StringComparison.OrdinalIgnoreCase));
    }

    private static (DateTime Start, DateTime End, string Preset) ResolveRange(
        DateTime? startDate,
        DateTime? endDate,
        string? preset)
    {
        var today = PhilippineTime.Today;
        if (startDate.HasValue || endDate.HasValue)
        {
            var start = (startDate ?? endDate ?? today).Date;
            var end = (endDate ?? startDate ?? today).Date;
            if (end < start) (start, end) = (end, start);
            return (start, end, string.IsNullOrWhiteSpace(preset) ? "Custom Range" : preset.Trim());
        }

        switch ((preset ?? "This Month").Trim().ToLowerInvariant())
        {
            case "today":
                return (today, today, "Today");
            case "this week":
            case "thisweek":
                var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
                return (today.AddDays(-daysSinceMonday), today.AddDays(6 - daysSinceMonday), "This Week");
            case "last month":
            case "lastmonth":
                var lastMonthStart = new DateTime(today.Year, today.Month, 1).AddMonths(-1);
                return (lastMonthStart, lastMonthStart.AddMonths(1).AddDays(-1), "Last Month");
            default:
                var monthStart = new DateTime(today.Year, today.Month, 1);
                return (monthStart, monthStart.AddMonths(1).AddDays(-1), "This Month");
        }
    }
}
