using LechonSystem.Api.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    // 1. THE DTOs
    public class PendingConfirmationDto
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string OrderReference { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? FacebookName { get; set; }
        public string Source { get; set; } = string.Empty;
        public string ContactNumber { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public DateTime TargetDeliveryTime { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal BalanceDue { get; set; }
        public string ItemsSummary { get; set; } = string.Empty;
    }

    public class DeliveryVerificationDto
    {
        public int Id { get; set; }
        public string OrderReference { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? FacebookName { get; set; }
        public string Source { get; set; } = string.Empty;
        public string DeliveryAddress { get; set; } = string.Empty;
        public string? Landmark { get; set; }
        public string PhoneNumber { get; set; } = string.Empty;
        public DateTime TargetDeliveryTime { get; set; }
        public DateTime? RiderDepartureTime { get; set; }
    }

    public class PendingOwnerConfirmationDto
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string OrderReference { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? FacebookName { get; set; }
        public string Source { get; set; } = string.Empty;
        public DateTime? TargetDeliveryTime { get; set; }
        public string ItemsSummary { get; set; } = string.Empty;
        public string? FreebiesSummary { get; set; }
        public string? FreebiesConfigJson { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal Downpayment { get; set; }
        public string DownpaymentMethod { get; set; } = "None";
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsOwnerConfirmed { get; set; }
        public DateTime? OwnerConfirmedAt { get; set; }
        public string? OwnerConfirmedBy { get; set; }
    }

    public class DefrostRosterDto
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string OrderReference { get; set; } = string.Empty;
        public int ItemCategoryId { get; set; }
        public string WeightCategory { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public string WeightRange { get; set; } = string.Empty;
        public decimal MinimumWeightKg { get; set; }
        public decimal MaximumWeightKg { get; set; }
        public int Quantity { get; set; }
        public DateTime TahiStartTime { get; set; }

        public string CustomerName { get; set; } = string.Empty;
        public string? FacebookName { get; set; }
        public string Source { get; set; } = string.Empty;
        public string? EventType { get; set; }
        public string? Landmark { get; set; }
        public DateTime TargetDeliveryTime { get; set; }
        public DateTime? RiderDepartureTime { get; set; }
        public bool IsTrustedCustomer { get; set; }
        public bool IsRushDefrost { get; set; }
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
        Task<List<PendingOwnerConfirmationDto>> GetPendingOwnerConfirmationsAsync();
        Task<List<DeliveryVerificationDto>> GetDeliveryVerificationsAsync();
        Task<List<DefrostRosterDto>> GetDefrostingRosterAsync();
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
            var today = PhilippineTime.Today;
            var fourDaysFromNow = today.AddDays(4);

            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .Where(o => !o.IsDraft
                         && !o.IsCancelled
                         && o.Downpayment == 0
                         && !o.IsTrustedCustomer
                         && o.TargetDeliveryTime != null
                         && o.TargetDeliveryTime.Value.Date >= today
                         && o.TargetDeliveryTime.Value.Date <= fourDaysFromNow)
                .OrderBy(o => o.TargetDeliveryTime)
                .ToListAsync();

            return orders.Select(o =>
            {
                var itemParts = o.OrderItems.Select(oi =>
                    $"{oi.Quantity}x {oi.ItemCategory?.Name ?? "Lechon"}"
                ).ToList();

                if (!string.IsNullOrWhiteSpace(o.AddOns))
                {
                    itemParts.Add(o.AddOns.Trim());
                }

                var summary = itemParts.Count > 0
                    ? string.Join(", ", itemParts)
                    : "Lechon Reservation";

                var contact = o.ContactNumber ?? string.Empty;

                return new PendingConfirmationDto
                {
                    Id = o.Id,
                    OrderId = o.Id,
                    OrderReference = o.OrderReference,
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    Source = o.Source,
                    ContactNumber = contact,
                    PhoneNumber = contact,
                    TargetDeliveryTime = o.TargetDeliveryTime!.Value,
                    GrandTotal = o.GrandTotal,
                    TotalAmount = o.GrandTotal,
                    BalanceDue = o.GrandTotal - o.Downpayment,
                    ItemsSummary = summary
                };
            }).ToList();
        }

        public async Task<List<PendingOwnerConfirmationDto>> GetPendingOwnerConfirmationsAsync()
        {
            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .Where(o => !o.IsCancelled && !o.IsDraft && !o.IsOwnerConfirmed)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return orders.Select(o =>
            {
                var itemParts = o.OrderItems
                    .Select(oi => $"{oi.Quantity}x {oi.ItemCategory?.Name ?? "Lechon"}")
                    .ToList();
                if (!string.IsNullOrWhiteSpace(o.AddOns)) itemParts.Add(o.AddOns.Trim());

                return new PendingOwnerConfirmationDto
                {
                    Id = o.Id,
                    OrderId = o.Id,
                    OrderReference = o.OrderReference,
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    Source = o.Source,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    ItemsSummary = itemParts.Count > 0 ? string.Join(", ", itemParts) : "Lechon Reservation",
                    FreebiesSummary = o.FreebiesSummary,
                    FreebiesConfigJson = o.FreebiesConfigJson,
                    DeliveryFee = o.DeliveryFee,
                    GrandTotal = o.GrandTotal,
                    Downpayment = o.Downpayment,
                    DownpaymentMethod = o.DownpaymentMethod,
                    CreatedBy = o.CreatedBy,
                    CreatedAt = o.CreatedAt,
                    IsOwnerConfirmed = o.IsOwnerConfirmed,
                    OwnerConfirmedAt = o.OwnerConfirmedAt,
                    OwnerConfirmedBy = o.OwnerConfirmedBy
                };
            }).ToList();
        }

        public async Task<List<DeliveryVerificationDto>> GetDeliveryVerificationsAsync()
        {
            var twoDaysFromNow = DateTime.UtcNow.AddDays(2);

            return await _context.Orders
                .AsNoTracking()
                .Where(o => !o.IsDraft
                         && !o.IsCancelled
                         && o.TargetDeliveryTime != null
                         && o.TargetDeliveryTime.Value >= DateTime.UtcNow
                         && o.TargetDeliveryTime.Value <= twoDaysFromNow
                         && o.IsDeliveryDetailsConfirmed == false)
                .Select(o => new DeliveryVerificationDto
                {
                    Id = o.Id,
                    OrderReference = o.OrderReference,
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    Source = o.Source,
                    TargetDeliveryTime = o.TargetDeliveryTime!.Value,
                    RiderDepartureTime = o.RiderDepartureTime,
                    DeliveryAddress = o.DeliveryAddress ?? string.Empty,
                    Landmark = o.Landmark,
                    PhoneNumber = o.ContactNumber ?? string.Empty
                })
                .ToListAsync();
        }

        public async Task<List<DefrostRosterDto>> GetDefrostingRosterAsync()
        {
            var tomorrow = PhilippineTime.Tomorrow;

            var schedules = await _context.OrderItemSchedules
                .AsNoTracking()
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                .Where(s => s.OrderItem != null 
                         && s.OrderItem.ItemCategory != null
                         && s.OrderItem.ItemCategory.MinimumWeightKg > 0
                         && s.OrderItem.Order != null 
                         && !s.OrderItem.Order.IsDraft
                         && !s.OrderItem.Order.IsCancelled 
                         && s.TahiStartTime.Date == tomorrow)
                .OrderBy(s => s.TahiStartTime)
                .ToListAsync();

            return schedules.Select(s =>
            {
                var order = s.OrderItem!.Order!;
                var catName = s.OrderItem.ItemCategory?.Name ?? "Lechon";
                var itemCatId = s.OrderItem.ItemCategoryId;
                var minWeight = s.OrderItem.ItemCategory?.MinimumWeightKg ?? 0m;
                var maxWeight = s.OrderItem.ItemCategory?.MaximumWeightKg ?? 0m;
                var weightRange = (minWeight > 0 || maxWeight > 0)
                    ? (minWeight == maxWeight
                        ? $"{minWeight:0.##}"
                        : $"{minWeight:0.##}-{maxWeight:0.##}")
                    : string.Empty;

                var rushCutoff = s.TahiStartTime.Date.AddDays(-1).AddHours(12);
                if (s.TahiStartTime.Hour >= 12)
                {
                    rushCutoff = s.TahiStartTime.Date.AddHours(12);
                }
                bool isRush = order.CreatedAt >= rushCutoff;

                return new DefrostRosterDto
                {
                    Id = s.OrderItemId,
                    OrderId = order.Id,
                    OrderReference = order.OrderReference,
                    ItemCategoryId = itemCatId,
                    WeightCategory = catName,
                    CategoryName = catName,
                    WeightRange = weightRange,
                    MinimumWeightKg = minWeight,
                    MaximumWeightKg = maxWeight,
                    Quantity = s.OrderItem.Quantity,
                    TahiStartTime = s.TahiStartTime,
                    CustomerName = order.CustomerName,
                    FacebookName = order.FacebookName,
                    Source = order.Source,
                    EventType = order.EventType,
                    Landmark = order.Landmark,
                    TargetDeliveryTime = order.TargetDeliveryTime ?? DateTime.MinValue,
                    RiderDepartureTime = order.RiderDepartureTime,
                    IsTrustedCustomer = order.IsTrustedCustomer,
                    IsRushDefrost = isRush,
                    Fulfillment = (int)order.Fulfillment,
                    DeliveryAddress = order.DeliveryAddress ?? string.Empty,
                    GrandTotal = order.GrandTotal,
                    Downpayment = order.Downpayment,
                    BalanceDue = order.GrandTotal - order.Downpayment
                };
            }).ToList();
        }

        public async Task<List<RenegotiationTaskDto>> GetRenegotiationTasksAsync()
        {
            return await _context.OrderItems
                .Where(item => 
                    !item.Order!.IsDraft &&
                    !item.Order.IsCancelled &&
                    !item.Order.IsPriceWaived &&
                    item.Order.TargetDeliveryTime != null &&
                    item.Order.TargetDeliveryTime >= PhilippineTime.Today &&
                    item.ItemCategory!.MinimumWeightKg > 0 &&
                    item.Price > 0 &&
                    item.Price < item.ItemCategory.BasePrice)
                .GroupBy(item => new
                {
                    item.OrderId,
                    OrderReference = item.Order!.OrderReference,
                    CustomerName = item.Order!.CustomerName,
                    FacebookName = item.Order.FacebookName,
                    Source = item.Order.Source,
                    TargetDeliveryTime = item.Order.TargetDeliveryTime!.Value
                })
                .Select(g => new RenegotiationTaskDto
                {
                    OrderId = g.Key.OrderId,
                    OrderReference = g.Key.OrderReference,
                    CustomerName = g.Key.CustomerName,
                    FacebookName = g.Key.FacebookName,
                    Source = g.Key.Source,
                    TargetDeliveryTime = g.Key.TargetDeliveryTime,
                    PriceGap = g.Sum(item => item.ItemCategory!.BasePrice - item.Price)
                })
                .AsNoTracking()
                .ToListAsync();
        }
    }
}
