using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    // 1. THE DTOs
    public class PendingConfirmationDto
    {
        public int Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public DateTime TargetDeliveryTime { get; set; }
        public string PhoneNumber { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
    }

    public class DeliveryVerificationDto
    {
        public int Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string DeliveryAddress { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public DateTime TargetDeliveryTime { get; set; }
    }

    // 🚀 Added the missing Defrost DTO here!
    public class DefrostRosterDto
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string WeightCategory { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public DateTime TahiStartTime { get; set; }

        // NEW FIELDS FOR THE DASHBOARD HUD
        public string CustomerName { get; set; } = string.Empty;
        public DateTime TargetDeliveryTime { get; set; }
        public bool IsTrustedCustomer { get; set; }
        public string DeliveryAddress { get; set; } = string.Empty;
        public int Fulfillment { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal Downpayment { get; set; }
        public decimal BalanceDue { get; set; }
    }

    // 2. THE INTERFACE
    public interface IDashboardService
    {
        Task<List<PendingConfirmationDto>> GetPendingConfirmationsAsync();
        Task<List<DeliveryVerificationDto>> GetDeliveryVerificationsAsync();
        Task<List<DefrostRosterDto>> GetDefrostingRosterAsync(); // 🚀 Updated to use the DTO!

        Task<List<RenegotiationTaskDto>> GetRenegotiationTasksAsync();
    }

    // 3. THE IMPLEMENTATION
    public class DashboardService : IDashboardService
    {
        private readonly LechonDbContext _context;

        public DashboardService(LechonDbContext context)
        {
            _context = context;
        }

        public async Task<List<PendingConfirmationDto>> GetPendingConfirmationsAsync()
        {
            var fourDaysFromNow = DateTime.UtcNow.AddDays(4);

            return await _context.Orders
                // 1. Keep your original inventory validation
                .Where(o => _context.InventoryReservations
                    .Any(r => r.OrderId == o.Id && r.ReservationStatus == ReservationStatus.Pending))

                // 2. Combine your date range with the new business logic filters
                .Where(o => o.TargetDeliveryTime >= DateTime.UtcNow
                         && o.TargetDeliveryTime <= fourDaysFromNow
                         && o.Downpayment == 0
                         && o.IsTrustedCustomer == false
                         && o.IsCancelled == false)

                // 3. Keep the OrderBy (it's good practice for dashboard lists)
                .OrderBy(o => o.TargetDeliveryTime)

                // 4. Keep your exact DTO naming and mapping
                .Select(o => new PendingConfirmationDto
                {
                    Id = o.Id,
                    CustomerName = o.CustomerName,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    PhoneNumber = o.ContactNumber ?? string.Empty,


                    TotalAmount = o.GrandTotal
                })
                .ToListAsync();
        }

        public async Task<List<DeliveryVerificationDto>> GetDeliveryVerificationsAsync()
        {
            var twoDaysFromNow = DateTime.UtcNow.AddDays(2);

            return await _context.Orders
                .Where(o => o.TargetDeliveryTime >= DateTime.UtcNow && o.TargetDeliveryTime <= twoDaysFromNow)
                .Where(o => o.IsDeliveryDetailsConfirmed == false)
                .Select(o => new DeliveryVerificationDto
                {
                    Id = o.Id,
                    CustomerName = o.CustomerName,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    DeliveryAddress = o.DeliveryAddress ?? string.Empty,
                    PhoneNumber = o.ContactNumber ?? string.Empty
                })
                .ToListAsync();
        }

        // 2. THE QUERY
        public async Task<List<DefrostRosterDto>> GetDefrostingRosterAsync()
        {
            var tomorrow = DateTime.UtcNow.Date.AddDays(1);

            return await _context.OrderItemSchedules
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                .Where(s => s.TahiStartTime.Date == tomorrow)
                .Select(s => new DefrostRosterDto
                {
                    Id = s.OrderItemId,
                    OrderId = s.OrderItem!.OrderId,
                    WeightCategory = s.OrderItem!.ItemCategory!.Name,
                    Quantity = s.OrderItem.Quantity,
                    TahiStartTime = s.TahiStartTime,
                    CustomerName = s.OrderItem.Order!.CustomerName,
                    TargetDeliveryTime = s.OrderItem.Order.TargetDeliveryTime,
                    IsTrustedCustomer = s.OrderItem.Order.IsTrustedCustomer,
                    Fulfillment = (int)s.OrderItem.Order.Fulfillment,
                    DeliveryAddress = s.OrderItem.Order.DeliveryAddress ?? string.Empty,
                    GrandTotal = s.OrderItem.Order.GrandTotal,
                    Downpayment = s.OrderItem.Order.Downpayment,
                    BalanceDue = s.OrderItem.Order.GrandTotal - s.OrderItem.Order.Downpayment
                })
                .ToListAsync();
        }


        public async Task<List<RenegotiationTaskDto>> GetRenegotiationTasksAsync()
        {
            return await _context.OrderItems
                .Where(item => 
                    !item.Order!.IsCancelled &&
                    !item.Order.IsPriceWaived &&
                    item.Order.TargetDeliveryTime >= DateTime.Today &&
                    item.ItemCategory!.MinimumWeightKg > 0 &&
                    item.Price > 0 &&
                    item.Price < item.ItemCategory.BasePrice)
                .GroupBy(item => new
                {
                    item.OrderId,
                    CustomerName = item.Order!.CustomerName,
                    TargetDeliveryTime = item.Order.TargetDeliveryTime
                })
                .Select(g => new RenegotiationTaskDto
                {
                    OrderId = g.Key.OrderId,
                    CustomerName = g.Key.CustomerName,
                    TargetDeliveryTime = g.Key.TargetDeliveryTime,
                    PriceGap = g.Sum(item => item.ItemCategory!.BasePrice - item.Price)
                })
                .AsNoTracking()
                .ToListAsync();
        }
    }
}