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
            // 1. Calculate the exact 4-day deadline in memory
            var fourDaysFromNow = DateTime.UtcNow.AddDays(4);

            return await _context.Orders
                // 2. Keep your original, correct check for Pending reservations
                .Where(o => _context.InventoryReservations
                    .Any(r => r.OrderId == o.Id && r.ReservationStatus == ReservationStatus.Pending))
                // 3. 🚨 OUR NEW ZERO-INBOX RULE: Target time must be between now and 4 days from now
                .Where(o => o.TargetDeliveryTime >= DateTime.UtcNow && o.TargetDeliveryTime <= fourDaysFromNow)
                .ToListAsync();
        }

        public async Task<List<Order>> GetDeliveryVerificationsAsync()
        {
            // 1. Calculate the exact 2-day deadline in memory
            var twoDaysFromNow = DateTime.UtcNow.AddDays(2);

            return await _context.Orders
                // 2. 🚨 OUR NEW ZERO-INBOX RULE: Target time must be between now and 2 days from now
                .Where(o => o.TargetDeliveryTime >= DateTime.UtcNow && o.TargetDeliveryTime <= twoDaysFromNow)
                // 3. Keep your original check: Only show if delivery details are still missing
                .Where(o => o.IsDeliveryDetailsConfirmed == false)
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