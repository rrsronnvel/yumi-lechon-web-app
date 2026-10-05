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

        public async Task<OrderItemSchedule> CalculateScheduleAsync(int orderItemId, DateTime targetDeliveryTime, int itemCategoryId)
        {
            var profile = await _context.ProductCookingProfiles
                .FirstOrDefaultAsync(p => p.ItemCategoryId == itemCategoryId);

            int tahiDuration = profile?.TahiDurationMinutes ?? 60;
            int salangDuration = profile?.SalangDurationMinutes ?? 180;
            int packagingDuration = profile?.PackagingDurationMinutes ?? 30;

            DateTime packagingStart = targetDeliveryTime.AddMinutes(-packagingDuration);
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
            var items = await _context.OrderItemSchedules
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                        .ThenInclude(o => o!.DeliveryTrip)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                .Where(s => s.TargetDeliveryTime.Date == targetDate.Date)
                .Select(s => new
                {
                    id = s.Id,
                    orderItemId = s.OrderItemId,
                    orderId = s.OrderItem!.OrderId,
                    customerName = s.OrderItem!.Order!.CustomerName,
                    size = s.OrderItem!.ItemCategory!.Name,
                    weight = s.OrderItem!.ItemCategory != null ? $"{s.OrderItem.ItemCategory.MinimumWeightKg}-{s.OrderItem.ItemCategory.MaximumWeightKg} kg" : "-",

                    // TIMINGS
                    targetDeliveryTime = s.TargetDeliveryTime.ToString("o"),
                    tahiStartTime = s.TahiStartTime.ToString("o"),
                    salangStartTime = s.SalangStartTime.ToString("o"),
                    packagingStartTime = s.PackagingStartTime.ToString("o"),

                    // LOGISTICS & NOTES
                    location = s.OrderItem!.Order!.DeliveryAddress,
                    remarks = s.OrderItem!.Order!.Remarks,
                    addOns = s.OrderItem!.Order!.AddOns ?? "-",

                    // Financials & Fulfillment for Rider View
                    price = s.OrderItem.Order.Price,
                    deliveryFee = s.OrderItem.Order.DeliveryFee,
                    downpayment = s.OrderItem.Order.Downpayment,
                    grandTotal = s.OrderItem.Order.GrandTotal,
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

            return items;
        }

        public async Task<OrderItemSchedule> OverrideScheduleItemAsync(int orderItemId, OverrideScheduleRequest request)
        {
            var schedule = await _context.OrderItemSchedules
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                        .ThenInclude(o => o!.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.OrderItemId == orderItemId || s.Id == orderItemId);

            if (schedule == null)
                throw new KeyNotFoundException($"Schedule for OrderItem #{orderItemId} not found.");

            if (request.TahiStartTime.HasValue)
                schedule.TahiStartTime = request.TahiStartTime.Value;

            if (request.SalangStartTime.HasValue)
                schedule.SalangStartTime = request.SalangStartTime.Value;

            if (request.PackagingStartTime.HasValue)
                schedule.PackagingStartTime = request.PackagingStartTime.Value;

            schedule.IsManualOverride = true;

            if (!string.IsNullOrWhiteSpace(request.Remarks) && schedule.OrderItem?.Order != null)
                schedule.OrderItem.Order.Remarks = request.Remarks;

            if (!string.IsNullOrWhiteSpace(request.RiderName) && schedule.OrderItem?.Order != null)
            {
                // Update assigned rider on active DeliveryTrip if present
                var trip = schedule.OrderItem.Order.DeliveryTrip
                    ?? await _context.DeliveryTrips.Include(t => t.Orders)
                        .FirstOrDefaultAsync(t => t.Orders.Any(o => o.Id == schedule.OrderItem.OrderId));

                if (trip != null)
                {
                    trip.RiderName = request.RiderName;
                }
                else
                {
                    trip = new DeliveryTrip
                    {
                        RiderName = request.RiderName,
                        VehicleType = "Motorcycle",
                        Status = DeliveryStatus.Assigned,
                        DispatchTime = DateTime.UtcNow
                    };
                    trip.Orders.Add(schedule.OrderItem.Order);
                    schedule.OrderItem.Order.RoutingStatus = DeliveryStatus.Assigned;
                    _context.DeliveryTrips.Add(trip);
                }
            }

            await _context.SaveChangesAsync();
            return schedule;
        }
    }
}