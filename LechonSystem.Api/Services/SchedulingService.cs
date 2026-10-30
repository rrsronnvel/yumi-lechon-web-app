using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Common;

namespace LechonSystem.Api.Services
{
    public class SchedulingService : ISchedulingService
    {
        private readonly LechonDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public SchedulingService(LechonDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        private string CurrentUser => UserIdentityHelper.ResolveDisplayName(_httpContextAccessor?.HttpContext?.User, "Owner");

        public async Task<OrderItemSchedule> CalculateScheduleAsync(
            int orderItemId,
            DateTime targetDeliveryTime,
            int itemCategoryId,
            DateTime? riderDepartureTime = null)
        {
            var profile = await _context.ProductCookingProfiles
                .FirstOrDefaultAsync(p => p.ItemCategoryId == itemCategoryId);

            int tahiDuration = profile?.TahiDurationMinutes ?? 60;
            int salangDuration = profile?.SalangDurationMinutes ?? 180;
            int packagingDuration = profile?.PackagingDurationMinutes ?? 30;

            if (!riderDepartureTime.HasValue && orderItemId > 0)
            {
                var orderDeparture = await _context.OrderItems
                    .AsNoTracking()
                    .Where(oi => oi.Id == orderItemId && oi.Order != null)
                    .Select(oi => oi.Order!.RiderDepartureTime)
                    .FirstOrDefaultAsync();
                riderDepartureTime = orderDeparture;
            }

            var anchorTime = riderDepartureTime ?? targetDeliveryTime;

            DateTime packagingStart = anchorTime.AddMinutes(-packagingDuration);
            DateTime salangStart = packagingStart.AddMinutes(-salangDuration);
            DateTime tahiStart = salangStart.AddMinutes(-tahiDuration);

            var schedule = new OrderItemSchedule
            {
                OrderItemId = orderItemId,
                TargetDeliveryTime = targetDeliveryTime,
                PackagingStartTime = packagingStart,
                SalangStartTime = salangStart,
                TahiStartTime = tahiStart
            };

            return schedule;
        }

        public async Task<object> GetDailyRosterAsync(DateTime targetDate)
        {
            var dailySheets = await GetDailySheetsAsync(targetDate);
            return dailySheets.Items;
        }

        public async Task<DailySheetsResponseDto> GetDailySheetsAsync(DateTime? date = null)
        {
            var targetDate = (date ?? PhilippineTime.Today).Date;

            var roastItems = await _context.OrderItemSchedules
                .AsNoTracking()
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                        .ThenInclude(o => o!.DeliveryTrip)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                .Where(s => s.OrderItem != null
                         && s.OrderItem.ItemCategory != null
                         && s.OrderItem.ItemCategory.MinimumWeightKg > 0
                         && s.OrderItem.Order != null
                         && !s.OrderItem.Order.IsDraft
                         && !s.OrderItem.Order.IsTimeTbd
                         && !s.OrderItem.Order.IsCancelled
                         && s.OrderItem.Order.TargetDeliveryTime.HasValue
                         && s.OrderItem.Order.TargetDeliveryTime.Value.Date == targetDate)
                .Select(s => new
                {
                    id = s.Id,
                    orderItemId = s.OrderItemId,
                    orderId = s.OrderItem!.OrderId,
                    orderReference = s.OrderItem!.Order!.OrderReference,
                    customerName = s.OrderItem!.Order!.CustomerName,
                    facebookName = s.OrderItem!.Order!.FacebookName,
                    contactNumber = s.OrderItem!.Order!.ContactNumber,
                    source = s.OrderItem!.Order!.Source,
                    eventType = s.OrderItem!.Order!.EventType,
                    landmark = s.OrderItem!.Order!.Landmark,
                    size = s.OrderItem!.ItemCategory!.Name,
                    categoryName = s.OrderItem!.ItemCategory!.Name,
                    minWeight = s.OrderItem!.ItemCategory != null ? s.OrderItem.ItemCategory.MinimumWeightKg : 0m,
                    maxWeight = s.OrderItem!.ItemCategory != null ? s.OrderItem.ItemCategory.MaximumWeightKg : 0m,

                    // TIMINGS
                    targetDeliveryTime = (DateTime?)s.TargetDeliveryTime,
                    riderDepartureTime = s.OrderItem!.Order!.RiderDepartureTime,
                    tahiStartTime = (DateTime?)s.TahiStartTime,
                    salangStartTime = (DateTime?)s.SalangStartTime,
                    packagingStartTime = (DateTime?)s.PackagingStartTime,

                    // LOGISTICS & NOTES
                    location = s.OrderItem!.Order!.DeliveryAddress ?? string.Empty,
                    remarks = s.OrderItem!.Order!.Remarks ?? string.Empty,
                    freebiesSummary = s.OrderItem!.Order!.FreebiesSummary,
                    freebiesConfigJson = s.OrderItem!.Order!.FreebiesConfigJson,
                    addOns = s.OrderItem!.Order!.AddOns ?? "-",

                    // Financials & Fulfillment for Rider View
                    price = s.OrderItem.Order.Price,
                    discount = s.OrderItem.Order.Discount,
                    addOnsTotal = s.OrderItem.Order.OrderItems
                        .Where(item => item.ItemCategory != null && item.ItemCategory.MinimumWeightKg <= 0)
                        .Sum(item => item.TotalPrice),
                    deliveryFee = s.OrderItem.Order.DeliveryFee,
                    downpayment = s.OrderItem.Order.Downpayment,
                    downpaymentMethod = s.OrderItem.Order.DownpaymentMethod,
                    grandTotal = s.OrderItem.Order.GrandTotal,
                    isTrustedCustomer = s.OrderItem.Order.IsTrustedCustomer,
                    isOwnerConfirmed = s.OrderItem.Order.IsOwnerConfirmed,
                    ownerConfirmedAt = s.OrderItem.Order.OwnerConfirmedAt,
                    ownerConfirmedBy = s.OrderItem.Order.OwnerConfirmedBy,
                    fulfillment = (int)s.OrderItem.Order.Fulfillment,
                    quantity = s.OrderItem.Quantity,

                    // Safely map Rider Name
                    riderName = s.OrderItem.Order.DeliveryTrip != null
                        ? s.OrderItem.Order.DeliveryTrip.RiderName
                        : "Unassigned",

                    status = s.CurrentStatus.ToString(),
                    isManualOverride = s.IsManualOverride
                })
                .ToListAsync();

            var result = roastItems.Select(s =>
            {
                var formattedWeight = (s.minWeight > 0 || s.maxWeight > 0)
                    ? (s.minWeight == s.maxWeight
                        ? $"{s.minWeight:0.##}"
                        : $"{s.minWeight:0.##}-{s.maxWeight:0.##}")
                    : "-";

                return new DailySheetItemDto
                {
                    Id = s.id,
                    OrderItemId = s.orderItemId,
                    OrderId = s.orderId,
                    OrderReference = s.orderReference,
                    CustomerName = s.customerName,
                    FacebookName = s.facebookName,
                    ContactNumber = s.contactNumber,
                    Source = s.source,
                    EventType = s.eventType,
                    Landmark = s.landmark,
                    Size = s.size,
                    CategoryName = s.categoryName,
                    Weight = formattedWeight,
                    WeightRange = formattedWeight,
                    MinWeight = s.minWeight,
                    MaxWeight = s.maxWeight,
                    MinimumWeightKg = s.minWeight,
                    MaximumWeightKg = s.maxWeight,
                    TargetDeliveryTime = s.targetDeliveryTime,
                    RiderDepartureTime = s.riderDepartureTime,
                    TahiStartTime = s.tahiStartTime,
                    SalangStartTime = s.salangStartTime,
                    PackagingStartTime = s.packagingStartTime,
                    Location = s.location,
                    Remarks = s.remarks,
                    FreebiesSummary = s.freebiesSummary,
                    FreebiesConfigJson = s.freebiesConfigJson,
                    AddOns = s.addOns,
                    Price = s.price,
                    LechonPrice = Math.Max(0, s.price - s.discount),
                    AddOnsTotal = s.addOnsTotal,
                    DeliveryFee = s.deliveryFee,
                    Downpayment = s.downpayment,
                    DownpaymentMethod = s.downpaymentMethod,
                    GrandTotal = s.grandTotal,
                    TotalToCollect = Math.Max(
                        0,
                        Math.Max(0, s.price - s.discount) + s.addOnsTotal + s.deliveryFee - s.downpayment),
                    IsTrustedCustomer = s.isTrustedCustomer,
                    IsOwnerConfirmed = s.isOwnerConfirmed,
                    OwnerConfirmedAt = s.ownerConfirmedAt,
                    OwnerConfirmedBy = s.ownerConfirmedBy,
                    Fulfillment = s.fulfillment,
                    Quantity = s.quantity,
                    RiderName = s.riderName,
                    Status = s.status,
                    IsManualOverride = s.isManualOverride,
                    IsTimeTbd = false
                };
            }).ToList();

            // Include confirmed Non-Lechon / Extras-Only orders scheduled on targetDate
            var nonLechonOrders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryTrip)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .Where(o => !o.IsDraft
                         && !o.IsCancelled
                         && !o.IsTimeTbd
                         && o.TargetDeliveryTime.HasValue
                         && o.TargetDeliveryTime.Value.Date == targetDate
                         && !o.OrderItems.Any(oi => oi.ItemCategory != null && oi.ItemCategory.MinimumWeightKg > 0))
                .ToListAsync();

            foreach (var order in nonLechonOrders)
            {
                var nonLechonItems = order.OrderItems.Where(oi => oi.ItemCategory == null || oi.ItemCategory.MinimumWeightKg == 0).ToList();
                var addOnsTotal = nonLechonItems.Sum(item => item.TotalPrice);
                if (addOnsTotal <= 0 && order.Price > 0)
                {
                    addOnsTotal = order.Price;
                }

                var totalToCollect = Math.Max(0, addOnsTotal + order.DeliveryFee - order.Downpayment);
                if (nonLechonItems.Count == 0)
                {
                    result.Add(new DailySheetItemDto
                    {
                        Id = order.Id,
                        OrderItemId = order.Id,
                        OrderId = order.Id,
                        OrderReference = order.OrderReference,
                        CustomerName = order.CustomerName,
                        FacebookName = order.FacebookName,
                        ContactNumber = order.ContactNumber,
                        Source = order.Source,
                        EventType = order.EventType,
                        Landmark = order.Landmark,
                        Size = "Extras",
                        CategoryName = "Extras",
                        Weight = "-",
                        WeightRange = "-",
                        MinWeight = 0,
                        MaxWeight = 0,
                        MinimumWeightKg = 0,
                        MaximumWeightKg = 0,
                        TargetDeliveryTime = order.TargetDeliveryTime,
                        RiderDepartureTime = order.RiderDepartureTime ?? order.TargetDeliveryTime,
                        TahiStartTime = null,
                        SalangStartTime = null,
                        PackagingStartTime = null,
                        Priority = null,
                        Location = order.DeliveryAddress ?? string.Empty,
                        Remarks = order.Remarks ?? string.Empty,
                        FreebiesSummary = order.FreebiesSummary,
                        FreebiesConfigJson = order.FreebiesConfigJson,
                        AddOns = order.AddOns ?? "-",
                        Price = order.Price,
                        LechonPrice = 0,
                        AddOnsTotal = addOnsTotal,
                        DeliveryFee = order.DeliveryFee,
                        Downpayment = order.Downpayment,
                        DownpaymentMethod = order.DownpaymentMethod,
                        GrandTotal = order.GrandTotal,
                        TotalToCollect = totalToCollect,
                        IsTrustedCustomer = order.IsTrustedCustomer,
                        IsOwnerConfirmed = order.IsOwnerConfirmed,
                        OwnerConfirmedAt = order.OwnerConfirmedAt,
                        OwnerConfirmedBy = order.OwnerConfirmedBy,
                        Fulfillment = (int)order.Fulfillment,
                        Quantity = 1,
                        RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                        Status = "Confirmed",
                        IsManualOverride = false,
                        IsTimeTbd = false
                    });
                }
                else
                {
                    foreach (var item in nonLechonItems)
                    {
                        var itemName = item.ItemCategory?.Name ?? "Extras";
                        result.Add(new DailySheetItemDto
                        {
                            Id = item.Id,
                            OrderItemId = item.Id,
                            OrderId = order.Id,
                            OrderReference = order.OrderReference,
                            CustomerName = order.CustomerName,
                            FacebookName = order.FacebookName,
                            ContactNumber = order.ContactNumber,
                            Source = order.Source,
                            EventType = order.EventType,
                            Landmark = order.Landmark,
                            Size = itemName,
                            CategoryName = itemName,
                            Weight = "-",
                            WeightRange = "-",
                            MinWeight = 0,
                            MaxWeight = 0,
                            MinimumWeightKg = 0,
                            MaximumWeightKg = 0,
                            TargetDeliveryTime = order.TargetDeliveryTime,
                            RiderDepartureTime = order.RiderDepartureTime ?? order.TargetDeliveryTime,
                            TahiStartTime = null,
                            SalangStartTime = null,
                            PackagingStartTime = null,
                            Priority = null,
                            Location = order.DeliveryAddress ?? string.Empty,
                            Remarks = order.Remarks ?? string.Empty,
                            FreebiesSummary = order.FreebiesSummary,
                            FreebiesConfigJson = order.FreebiesConfigJson,
                            AddOns = order.AddOns ?? "-",
                            Price = order.Price,
                            LechonPrice = 0,
                            AddOnsTotal = addOnsTotal,
                            DeliveryFee = order.DeliveryFee,
                            Downpayment = order.Downpayment,
                            DownpaymentMethod = order.DownpaymentMethod,
                            GrandTotal = order.GrandTotal,
                            TotalToCollect = totalToCollect,
                            IsTrustedCustomer = order.IsTrustedCustomer,
                            IsOwnerConfirmed = order.IsOwnerConfirmed,
                            OwnerConfirmedAt = order.OwnerConfirmedAt,
                            OwnerConfirmedBy = order.OwnerConfirmedBy,
                            Fulfillment = (int)order.Fulfillment,
                            Quantity = item.Quantity,
                            RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                            Status = "Confirmed",
                            IsManualOverride = false,
                            IsTimeTbd = false
                        });
                    }
                }
            }

            // Include Time-TBD orders scheduled on targetDate
            var timeTbdOrders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryTrip)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .Where(o => !o.IsDraft
                         && !o.IsCancelled
                         && o.IsTimeTbd
                         && o.TargetDeliveryTime.HasValue
                         && o.TargetDeliveryTime.Value.Date == targetDate)
                .ToListAsync();

            foreach (var order in timeTbdOrders)
            {
                var roastItemsList = order.OrderItems
                    .Where(oi => oi.ItemCategory != null && oi.ItemCategory.MinimumWeightKg > 0)
                    .ToList();

                var addOnsTotal = order.OrderItems
                    .Where(item => item.ItemCategory != null && item.ItemCategory.MinimumWeightKg <= 0)
                    .Sum(item => item.TotalPrice);

                var lechonPrice = Math.Max(0, order.Price - order.Discount);
                var totalToCollect = Math.Max(0, lechonPrice + addOnsTotal + order.DeliveryFee - order.Downpayment);

                if (roastItemsList.Count == 0)
                {
                    result.Add(new DailySheetItemDto
                    {
                        Id = order.Id,
                        OrderItemId = order.Id,
                        OrderId = order.Id,
                        OrderReference = order.OrderReference,
                        CustomerName = order.CustomerName,
                        FacebookName = order.FacebookName,
                        ContactNumber = order.ContactNumber,
                        Source = order.Source,
                        EventType = order.EventType,
                        Landmark = order.Landmark,
                        Size = "Order TBD",
                        CategoryName = "Order TBD",
                        Weight = "-",
                        WeightRange = "-",
                        MinWeight = 0,
                        MaxWeight = 0,
                        MinimumWeightKg = 0,
                        MaximumWeightKg = 0,
                        TargetDeliveryTime = order.TargetDeliveryTime,
                        RiderDepartureTime = null,
                        TahiStartTime = null,
                        SalangStartTime = null,
                        PackagingStartTime = null,
                        Priority = null,
                        Location = order.DeliveryAddress ?? string.Empty,
                        Remarks = order.Remarks ?? string.Empty,
                        FreebiesSummary = order.FreebiesSummary,
                        FreebiesConfigJson = order.FreebiesConfigJson,
                        AddOns = order.AddOns ?? "-",
                        Price = order.Price,
                        LechonPrice = lechonPrice,
                        AddOnsTotal = addOnsTotal,
                        DeliveryFee = order.DeliveryFee,
                        Downpayment = order.Downpayment,
                        DownpaymentMethod = order.DownpaymentMethod,
                        GrandTotal = order.GrandTotal,
                        TotalToCollect = totalToCollect,
                        IsTrustedCustomer = order.IsTrustedCustomer,
                        IsOwnerConfirmed = order.IsOwnerConfirmed,
                        OwnerConfirmedAt = order.OwnerConfirmedAt,
                        OwnerConfirmedBy = order.OwnerConfirmedBy,
                        Fulfillment = (int)order.Fulfillment,
                        Quantity = 1,
                        RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                        Status = "Time TBD",
                        IsManualOverride = false,
                        IsTimeTbd = true
                    });
                }
                else
                {
                    foreach (var item in roastItemsList)
                    {
                        var minW = item.ItemCategory?.MinimumWeightKg ?? 0m;
                        var maxW = item.ItemCategory?.MaximumWeightKg ?? 0m;
                        var formattedWeight = (minW > 0 || maxW > 0)
                            ? (minW == maxW ? minW.ToString("0.##") : $"{minW:0.##}-{maxW:0.##}")
                            : "-";

                        result.Add(new DailySheetItemDto
                        {
                            Id = item.Id,
                            OrderItemId = item.Id,
                            OrderId = order.Id,
                            OrderReference = order.OrderReference,
                            CustomerName = order.CustomerName,
                            FacebookName = order.FacebookName,
                            ContactNumber = order.ContactNumber,
                            Source = order.Source,
                            EventType = order.EventType,
                            Landmark = order.Landmark,
                            Size = item.ItemCategory?.Name ?? "Lechon",
                            CategoryName = item.ItemCategory?.Name ?? "Lechon",
                            Weight = formattedWeight,
                            WeightRange = formattedWeight,
                            MinWeight = minW,
                            MaxWeight = maxW,
                            MinimumWeightKg = minW,
                            MaximumWeightKg = maxW,
                            TargetDeliveryTime = order.TargetDeliveryTime,
                            RiderDepartureTime = null,
                            TahiStartTime = null,
                            SalangStartTime = null,
                            PackagingStartTime = null,
                            Priority = null,
                            Location = order.DeliveryAddress ?? string.Empty,
                            Remarks = order.Remarks ?? string.Empty,
                            FreebiesSummary = order.FreebiesSummary,
                            FreebiesConfigJson = order.FreebiesConfigJson,
                            AddOns = order.AddOns ?? "-",
                            Price = order.Price,
                            LechonPrice = lechonPrice,
                            AddOnsTotal = addOnsTotal,
                            DeliveryFee = order.DeliveryFee,
                            Downpayment = order.Downpayment,
                            DownpaymentMethod = order.DownpaymentMethod,
                            GrandTotal = order.GrandTotal,
                            TotalToCollect = totalToCollect,
                            IsTrustedCustomer = order.IsTrustedCustomer,
                            IsOwnerConfirmed = order.IsOwnerConfirmed,
                            OwnerConfirmedAt = order.OwnerConfirmedAt,
                            OwnerConfirmedBy = order.OwnerConfirmedBy,
                            Fulfillment = (int)order.Fulfillment,
                            Quantity = item.Quantity,
                            RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                            Status = "Time TBD",
                            IsManualOverride = false,
                            IsTimeTbd = true
                        });
                    }
                }
            }

            return new DailySheetsResponseDto
            {
                TargetDate = targetDate.ToString("yyyy-MM-dd"),
                FormattedDate = targetDate.ToString("dddd, MMMM dd, yyyy"),
                Items = result
            };
        }

        private static readonly TimeZoneInfo PhilippineTimeZone = GetPhilippineTimeZone();

        private static TimeZoneInfo GetPhilippineTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Singapore Standard Time"); // Windows ID for UTC+8
            }
            catch
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila"); // Linux / IANA ID
                }
                catch
                {
                    return TimeZoneInfo.CreateCustomTimeZone("PST", TimeSpan.FromHours(8), "Philippine Standard Time", "Philippine Standard Time");
                }
            }
        }

        private static DateTime NormalizeToLocalStoreTime(DateTime dt)
        {
            if (dt.Kind == DateTimeKind.Utc)
            {
                var localTime = TimeZoneInfo.ConvertTimeFromUtc(dt, PhilippineTimeZone);
                return DateTime.SpecifyKind(localTime, DateTimeKind.Unspecified);
            }

            if (dt.Kind == DateTimeKind.Local)
            {
                var utcTime = dt.ToUniversalTime();
                var localTime = TimeZoneInfo.ConvertTimeFromUtc(utcTime, PhilippineTimeZone);
                return DateTime.SpecifyKind(localTime, DateTimeKind.Unspecified);
            }

            return DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);
        }

        public Task<OrderItemSchedule> OverrideScheduleAsync(int orderItemId, OverrideScheduleRequest request)
            => OverrideScheduleItemAsync(orderItemId, request);

        public async Task<OrderItemSchedule> OverrideScheduleItemAsync(int orderItemId, OverrideScheduleRequest request)
        {
            var schedule = await _context.OrderItemSchedules
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                        .ThenInclude(o => o!.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.OrderItemId == orderItemId)
                ?? await _context.OrderItemSchedules
                    .Include(s => s.OrderItem)
                        .ThenInclude(oi => oi!.Order)
                            .ThenInclude(o => o!.DeliveryTrip)
                    .FirstOrDefaultAsync(s => s.Id == orderItemId);

            if (schedule == null)
                throw new KeyNotFoundException($"Schedule for OrderItem #{orderItemId} not found.");

            if (request.TahiStartTime.HasValue)
                schedule.TahiStartTime = NormalizeToLocalStoreTime(request.TahiStartTime.Value);

            if (request.SalangStartTime.HasValue)
                schedule.SalangStartTime = NormalizeToLocalStoreTime(request.SalangStartTime.Value);

            if (request.PackagingStartTime.HasValue)
                schedule.PackagingStartTime = NormalizeToLocalStoreTime(request.PackagingStartTime.Value);

            var effectiveDeparture = request.DepartureTime ?? request.RiderDepartureTime;
            if (effectiveDeparture.HasValue && schedule.OrderItem?.Order != null)
            {
                var normalizedDeparture = NormalizeToLocalStoreTime(effectiveDeparture.Value);
                schedule.OrderItem.Order.RiderDepartureTime = normalizedDeparture;
                if (schedule.OrderItem.Order.Fulfillment == FulfillmentType.Pickup || schedule.OrderItem.Order.Fulfillment == FulfillmentType.Lalamove)
                {
                    schedule.OrderItem.Order.TargetDeliveryTime = normalizedDeparture;
                    schedule.TargetDeliveryTime = normalizedDeparture;
                }
            }

            schedule.IsManualOverride = true;

            if (!string.IsNullOrWhiteSpace(request.Remarks) && schedule.OrderItem?.Order != null)
                schedule.OrderItem.Order.Remarks = request.Remarks;

            if (request.RiderName != null && schedule.OrderItem?.Order != null)
            {
                var cleanRider = request.RiderName.Trim();
                var oldRider = schedule.OrderItem.Order.DeliveryTrip?.RiderName?.Trim() ?? "";

                if (string.IsNullOrWhiteSpace(cleanRider) || cleanRider.Equals("Unassigned", StringComparison.OrdinalIgnoreCase))
                {
                    // Detach / Unassign rider
                    var oldTripId = schedule.OrderItem.Order.DeliveryTripId;
                    schedule.OrderItem.Order.DeliveryTripId = null;
                    schedule.OrderItem.Order.RoutingStatus = DeliveryStatus.Unassigned;

                    if (oldTripId.HasValue)
                    {
                        var hasOtherOrders = await _context.Orders.AnyAsync(o => o.DeliveryTripId == oldTripId.Value && o.Id != schedule.OrderItem.OrderId);
                        if (!hasOtherOrders)
                        {
                            var trip = await _context.DeliveryTrips.FindAsync(oldTripId.Value);
                            if (trip != null)
                            {
                                _context.DeliveryTrips.Remove(trip);
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(oldRider))
                    {
                        _context.OrderAuditLogs.Add(new OrderAuditLog
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ActionType = "Rider Updated",
                            Changes = $"Rider unassigned (previously '{oldRider}')",
                            ChangedBy = CurrentUser,
                            Timestamp = DateTime.UtcNow
                        });
                    }
                }
                else
                {
                    if (schedule.OrderItem.Order.Fulfillment != FulfillmentType.Delivery)
                    {
                        throw new InvalidOperationException("Only Delivery orders can be assigned to freelance riders.");
                    }

                    // Update assigned rider on active DeliveryTrip if present
                    var trip = schedule.OrderItem.Order.DeliveryTrip
                        ?? await _context.DeliveryTrips.Include(t => t.Orders)
                            .FirstOrDefaultAsync(t => t.Orders.Any(o => o.Id == schedule.OrderItem.OrderId));

                    if (trip != null)
                    {
                        trip.RiderName = cleanRider;
                    }
                    else
                    {
                        trip = new DeliveryTrip
                        {
                            RiderName = cleanRider,
                            VehicleType = "Motorcycle",
                            Status = DeliveryStatus.Assigned,
                            DispatchTime = DateTime.UtcNow
                        };
                        trip.Orders.Add(schedule.OrderItem.Order);
                        schedule.OrderItem.Order.RoutingStatus = DeliveryStatus.Assigned;
                        _context.DeliveryTrips.Add(trip);
                    }

                    if (!string.Equals(oldRider, cleanRider, StringComparison.OrdinalIgnoreCase))
                    {
                        string auditMsg = string.IsNullOrEmpty(oldRider)
                            ? $"Rider assigned: '{cleanRider}'"
                            : $"Rider changed from '{oldRider}' to '{cleanRider}'";

                        _context.OrderAuditLogs.Add(new OrderAuditLog
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ActionType = "Rider Updated",
                            Changes = auditMsg,
                            ChangedBy = CurrentUser,
                            Timestamp = DateTime.UtcNow
                        });
                    }
                }
            }

            await _context.SaveChangesAsync();
            return schedule;
        }
    }
}
