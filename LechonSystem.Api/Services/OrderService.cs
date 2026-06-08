using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services
{
    public interface IOrderService
    {
        Task<Order> CreateOrderAsync(CreateOrderRequest request);
    }

    public class OrderService : IOrderService
    {
        private readonly LechonDbContext _context;
        private readonly ISchedulingService _schedulingService; 
        // 1. Declare your new state machine service field
        private readonly IInventoryService _inventoryService;

        // 2. Expand constructor parameters to inject the Inventory Service
        public OrderService(
            LechonDbContext context, 
            ISchedulingService schedulingService,
            IInventoryService inventoryService)
        {
            _context = context;
            _schedulingService = schedulingService;
            _inventoryService = inventoryService; // Assign it here!
        }

        public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
        {
            // Create the Master Container
            var order = new Order
            {
                CustomerName = request.CustomerName,
                ContactNumber = request.ContactNumber,
                Source = request.Source,
                TargetDeliveryTime = request.TargetDeliveryTime,
                IsDeliveryDetailsConfirmed = false // Enforcing our core business rule safeguard!
            };

            // Build the item detail rows
            foreach (var itemDto in request.Items)
            {
                var orderItem = new OrderItem
                {
                    ItemCategoryId = itemDto.ItemCategoryId,
                    Quantity = itemDto.Quantity,
                    TotalPrice = 0 // In a later sprint, we will securely fetch the real seed price here!
                };
                order.OrderItems.Add(orderItem);
            }

            // Save the order and its items first so Entity Framework generates their real Database IDs
            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            // 3. Loop through saved items to auto-generate timelines AND inventory holds!
            foreach (var savedItem in order.OrderItems)
            {
                // Call our backward-scheduling math engine
                var calculatedSchedule = await _schedulingService.CalculateScheduleAsync(
                    savedItem.Id, 
                    order.TargetDeliveryTime, 
                    savedItem.ItemCategoryId
                );

                // Add the new schedule to the tracking context
                _context.OrderItemSchedules.Add(calculatedSchedule);

                // --- NEW ARCHITECTURAL HOOK POINT ---
                // 4. Command the inventory system to safely flag a temporary 'Pending' stock reservation
                await _inventoryService.CreatePendingReservationAsync(
                    order.Id, 
                    savedItem.ItemCategoryId, 
                    order.TargetDeliveryTime
                );
            }

            // Save both the schedules and the inventory reservations permanently to the database
            await _context.SaveChangesAsync();

            return order;
        }
    }
}