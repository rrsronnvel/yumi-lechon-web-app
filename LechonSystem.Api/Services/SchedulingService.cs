using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public class SchedulingService : ISchedulingService
    {
        private readonly LechonDbContext _context;

        public SchedulingService(LechonDbContext context)
        {
            _context = context;
        }

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
            return await GetDailySheetsAsync(targetDate);
        }

        public async Task<System.Collections.Generic.List<DailySheetItemDto>> GetDailySheetsAsync(DateTime targetDate)
        {
            var items = await _context.OrderItemSchedules
                .AsNoTracking()
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                        .ThenInclude(o => o!.DeliveryTrip)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                .Where(s => s.TargetDeliveryTime.Date == targetDate.Date
                         && s.OrderItem != null
                         && s.OrderItem.ItemCategory != null
                         && s.OrderItem.ItemCategory.MinimumWeightKg > 0
                         && s.OrderItem.Order != null
                         && !s.OrderItem.Order.IsDraft
                         && !s.OrderItem.Order.IsCancelled)
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
                    targetDeliveryTime = s.TargetDeliveryTime,
                    riderDepartureTime = s.OrderItem!.Order!.RiderDepartureTime,
                    tahiStartTime = s.TahiStartTime,
                    salangStartTime = s.SalangStartTime,
                    packagingStartTime = s.PackagingStartTime,

                    // LOGISTICS & NOTES
                    location = s.OrderItem!.Order!.DeliveryAddress ?? string.Empty,
                    remarks = s.OrderItem!.Order!.Remarks ?? string.Empty,
                    freebiesSummary = s.OrderItem!.Order!.FreebiesSummary,
                    freebiesConfigJson = s.OrderItem!.Order!.FreebiesConfigJson,
                    addOns = s.OrderItem!.Order!.AddOns ?? "-",

                    // Financials & Fulfillment for Rider View
                    price = s.OrderItem.Order.Price,
                    deliveryFee = s.OrderItem.Order.DeliveryFee,
                    downpayment = s.OrderItem.Order.Downpayment,
                    downpaymentMethod = s.OrderItem.Order.DownpaymentMethod,
                    grandTotal = s.OrderItem.Order.GrandTotal,
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

            return items.Select(s =>
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
                    DeliveryFee = s.deliveryFee,
                    Downpayment = s.downpayment,
                    DownpaymentMethod = s.downpaymentMethod,
                    GrandTotal = s.grandTotal,
                    IsOwnerConfirmed = s.isOwnerConfirmed,
                    OwnerConfirmedAt = s.ownerConfirmedAt,
                    OwnerConfirmedBy = s.ownerConfirmedBy,
                    Fulfillment = s.fulfillment,
                    Quantity = s.quantity,
                    RiderName = s.riderName,
                    Status = s.status,
                    IsManualOverride = s.isManualOverride
                };
            }).ToList();
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
                schedule.OrderItem.Order.RiderDepartureTime = NormalizeToLocalStoreTime(effectiveDeparture.Value);

            schedule.IsManualOverride = true;

            if (!string.IsNullOrWhiteSpace(request.Remarks) && schedule.OrderItem?.Order != null)
                schedule.OrderItem.Order.Remarks = request.Remarks;

            if (request.RiderName != null && schedule.OrderItem?.Order != null)
            {
                var cleanRider = request.RiderName.Trim();
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
                }
            }

            await _context.SaveChangesAsync();
            return schedule;
        }
    }
}
