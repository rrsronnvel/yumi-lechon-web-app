using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public interface IDashboardService
    {
        Task<List<Order>> GetPendingConfirmationsAsync();
        Task<List<Order>> GetDeliveryVerificationsAsync();
        Task<List<OrderItemSchedule>> GetDefrostingRosterAsync();
    }

    public class DashboardService : IDashboardService
    {
        private readonly LechonDbContext _context;

        public DashboardService(LechonDbContext context)
        {
            _context = context;
        }

        public async Task<List<Order>> GetPendingConfirmationsAsync()
        {
            var deadline = DateTime.UtcNow.AddHours(48);

            // Fetch orders happening in the next 48 hours that still have a Pending reservation
            return await _context.Orders
                .Where(o => o.TargetDeliveryTime <= deadline && o.TargetDeliveryTime >= DateTime.UtcNow)
                .Where(o => _context.InventoryReservations
                    .Any(r => r.OrderId == o.Id && r.ReservationStatus == ReservationStatus.Pending))
                .ToListAsync();
        }

        public async Task<List<Order>> GetDeliveryVerificationsAsync()
        {
            var tomorrow = DateTime.UtcNow.Date.AddDays(1);

            // Fetch orders scheduled for tomorrow where delivery details are NOT confirmed
            return await _context.Orders
                .Where(o => o.TargetDeliveryTime.Date == tomorrow && o.IsDeliveryDetailsConfirmed == false)
                .ToListAsync();
        }

        public async Task<List<OrderItemSchedule>> GetDefrostingRosterAsync()
        {
            var tomorrow = DateTime.UtcNow.Date.AddDays(1);

            // Fetch schedules where preparation (Tahi) starts tomorrow
            return await _context.OrderItemSchedules
                .Include(s => s.OrderItem) // Pull in the item details so staff knows what to defrost
                .Where(s => s.TahiStartTime.Date == tomorrow)
                .ToListAsync();
        }
    }
}