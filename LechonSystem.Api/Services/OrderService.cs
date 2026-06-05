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
        private readonly ISchedulingService _schedulingService; // 1. Bring in the Scheduling Service

        // 2. Inject both the Database Context and the Scheduling Service via the constructor
        public OrderService(LechonDbContext context, ISchedulingService schedulingService)
        {
            _context = context;
            _schedulingService = schedulingService;
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

            // 3. Now that the items have real database IDs, loop through them to auto-generate timelines!
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
            }

            // Save the schedules permanently to the database
            await _context.SaveChangesAsync();

            return order;
        }
    }
}