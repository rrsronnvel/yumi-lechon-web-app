using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore; // <-- Step 3: Added this for FirstOrDefaultAsync
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Interfaces;


namespace LechonSystem.Api.Services
{
    // Step 1: The Menu (Interface) - Only signatures!
    public interface IOrderService
    {
        Task<Order> CreateOrderAsync(CreateOrderRequest request);
        Task<bool> ConfirmPaymentAsync(int orderId);
        Task<bool> ConfirmDeliveryDetailsAsync(int orderId);
    }

    // Step 2: The Kitchen (Class) - The actual logic!
    public class OrderService : IOrderService
    {
        private readonly LechonDbContext _context;
        private readonly ISchedulingService _schedulingService;
        private readonly IInventoryService _inventoryService;

        private readonly INotificationSender _notificationSender;

        public OrderService(
            LechonDbContext context,
            ISchedulingService schedulingService,
            IInventoryService inventoryService,
            INotificationSender notificationSender)
        {
            _context = context;
            _schedulingService = schedulingService;
            _inventoryService = inventoryService;
            _notificationSender = notificationSender;
        }

        public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
        {
            var order = new Order
            {
                CustomerName = request.CustomerName,
                ContactNumber = request.ContactNumber,
                Source = request.Source,
                TargetDeliveryTime = request.TargetDeliveryTime,
                IsDeliveryDetailsConfirmed = false,

            
                Fulfillment = request.Fulfillment
            };
         
            foreach (var itemDto in request.Items)
            {
                var orderItem = new OrderItem
                {
                    ItemCategoryId = itemDto.ItemCategoryId,
                    Quantity = itemDto.Quantity,
                    TotalPrice = 0
                };
                order.OrderItems.Add(orderItem);
            }

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            foreach (var savedItem in order.OrderItems)
            {
                var calculatedSchedule = await _schedulingService.CalculateScheduleAsync(
                    savedItem.Id,
                    order.TargetDeliveryTime,
                    savedItem.ItemCategoryId
                );

                _context.OrderItemSchedules.Add(calculatedSchedule);

                await _inventoryService.CreatePendingReservationAsync(
                    order.Id,
                    savedItem.ItemCategoryId,
                    order.TargetDeliveryTime
                );
            }

            await _context.SaveChangesAsync();
            return order;
        }

        // Moved from the Interface to the Class
        public async Task<bool> ConfirmPaymentAsync(int orderId)
        {
            var reservation = await _context.InventoryReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId);

            if (reservation == null) return false;

            reservation.ReservationStatus = ReservationStatus.Committed;

            var order = await _context.Orders.FindAsync(orderId);
            if (order == null) return false;

            // FIX HERE: Change customerPhone to read order.ContactNumber
            string customerPhone = order.ContactNumber;
            string message = $"Hi {order.CustomerName}, your downpayment for Order #{order.Id} has been verified! Your lechon reservation is now locked in. 🐷";

            bool dispatchSuccess = await _notificationSender.SendMessageAsync(customerPhone, message);

            var log = new NotificationLog
            {
                OrderId = order.Id,
                RecipientPhone = customerPhone,
                MessageBody = message,
                SentAt = DateTime.UtcNow,
                IsSuccess = dispatchSuccess
            };

            _context.NotificationLogs.Add(log);
            await _context.SaveChangesAsync();
            return true;
        }

        // Moved from the Interface to the Class
        public async Task<bool> ConfirmDeliveryDetailsAsync(int orderId)
        {
            var order = await _context.Orders.FindAsync(orderId);

            if (order == null) return false;

            order.IsDeliveryDetailsConfirmed = true;

            await _context.SaveChangesAsync();
            return true;
        }
    }
}