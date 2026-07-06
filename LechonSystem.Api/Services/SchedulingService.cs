using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    // 1. Here is our unified Interface (The Menu)
    public interface ISchedulingService
    {
        Task<OrderItemSchedule> CalculateScheduleAsync(int orderItemId, DateTime targetDeliveryTime, int itemCategoryId);
        // UPDATE THIS LINE: Add the DateTime parameter
        Task<object> GetDailyRosterAsync(DateTime targetDate);
    }

    // 2. Here is our Class (The Kitchen)
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
                        .ThenInclude(o => o!.DeliveryTrip) // 👈 1. Join the Delivery Trip!
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                // FILTER: Only pull records where the TargetDeliveryTime falls on the requested date
                .Where(s => s.TargetDeliveryTime.Date == targetDate.Date)
                .Select(s => new
                {
                    id = s.Id,
                    orderId = s.OrderItem!.OrderId, // 👈 Added for the Rider View
                    customerName = s.OrderItem!.Order!.CustomerName,
                    size = s.OrderItem!.ItemCategory!.Name,

                    // TIMINGS
                    targetDeliveryTime = s.TargetDeliveryTime.ToString("o"),
                    tahiStartTime = s.TahiStartTime.ToString("o"),
                    salangStartTime = s.SalangStartTime.ToString("o"),
                    packagingStartTime = s.PackagingStartTime.ToString("o"),

                    // LOGISTICS & NOTES
                    location = s.OrderItem!.Order!.DeliveryAddress,
                    remarks = s.OrderItem!.Order!.Remarks,
                    addOns = s.OrderItem!.Order!.AddOns ?? "-",

                    // 👇 2. Financials for the Rider View
                    price = s.OrderItem.Order.Price,
                    deliveryFee = s.OrderItem.Order.DeliveryFee,

                    // 👇 3. Safely map the Rider Name!
                    riderName = s.OrderItem.Order.DeliveryTrip != null
                        ? s.OrderItem.Order.DeliveryTrip.RiderName
                        : "Unassigned",

                    status = s.CurrentStatus.ToString()
                })
                .ToListAsync();

            return items;
        }
    }
}