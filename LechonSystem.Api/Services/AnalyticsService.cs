using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public interface IAnalyticsService
    {
        Task<object> GetDailySalesAsync();
        Task<object> GetDeliveryPerformanceAsync();
        Task<object> GetInventoryWastageAsync();
    }

    public class AnalyticsService : IAnalyticsService
    {
        private readonly LechonDbContext _context;

        public AnalyticsService(LechonDbContext context)
        {
            _context = context;
        }

        public async Task<object> GetDailySalesAsync()
        {
            return await _context.PaymentLogs
                .AsNoTracking()
                .Where(p => p.Status == PaymentStatus.Success)
                .GroupBy(p => p.CreatedAt.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    TotalRevenue = g.Sum(p => p.Amount)
                })
                .OrderByDescending(r => r.Date)
                .ToListAsync();
        }

        public async Task<object> GetDeliveryPerformanceAsync()
        {
            return await _context.DeliveryTrips
                .AsNoTracking()
                .Where(t => t.ActualReturnTime != null) // This is our bouncer guarding the door
                .Select(t => new
                {
                    TripId = t.Id,
                    RiderName = t.RiderName,
                    // FIXED: Using ?? DateTime.MinValue satisfies the compiler that a value will always exist
                    TurnaroundMinutes = EF.Functions.DateDiffMinute(t.DispatchTime, t.ActualReturnTime ?? DateTime.MinValue)
                })
                .ToListAsync();
        }

        public async Task<object> GetInventoryWastageAsync()
        {
            return await _context.InventoryTransactions
                .AsNoTracking()
                .Where(t => t.Type == TransactionType.Adjustment && t.Quantity < 0)
                .GroupBy(t => t.ItemCategoryId)
                .Select(g => new
                {
                    ItemCategoryId = g.Key,
                    TotalItemsLost = g.Sum(t => Math.Abs(t.Quantity))
                })
                .ToListAsync();
        }
    }
}