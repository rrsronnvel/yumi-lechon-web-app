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
        Task<object> GetDailyRosterAsync(); 
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

        public async Task<object> GetDailyRosterAsync()
        {
            var items = await _context.OrderItemSchedules
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                .Select(s => new
                {
                    id = s.Id,
                    // 3. We use the '!' (Null-Forgiving Operator) to silence the compiler warnings safely
                    customerName = s.OrderItem!.Order!.CustomerName, 
                    size = s.OrderItem!.ItemCategory!.Name, 
                    targetDeliveryTime = s.TargetDeliveryTime.ToString("h:mm tt"), 
                    status = s.CurrentStatus.ToString()
                })
                .ToListAsync();

            return items;
        }
    }
}