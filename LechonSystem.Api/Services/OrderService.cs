using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore; // <-- Step 3: Added this for FirstOrDefaultAsync
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Interfaces;
using LechonSystem.Api.Models.DTOs;


namespace LechonSystem.Api.Services
{
    // Step 1: The Menu (Interface) - Only signatures!
    public interface IOrderService
    {
        Task<Order> CreateOrderAsync(CreateOrderRequest request);
        Task<bool> ConfirmPaymentAsync(int orderId);
        Task<bool> ConfirmDeliveryDetailsAsync(int orderId);

        Task<bool> CancelOrderAsync(int orderId);

        Task<List<OrderDirectoryDto>> GetOrderDirectoryAsync(string? searchTerm, string? filterTab);
        Task UpdateOrderAsync(int id, UpdateOrderDto request);
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
                // -- Core Details --
                CustomerName = request.CustomerName,
                TargetDeliveryTime = request.TargetDeliveryTime,
                Fulfillment = request.Fulfillment,
                IsDeliveryDetailsConfirmed = false, // Good practice to explicitly set this!

                // -- 🚀 NEW MAPPINGS HERE --
                ContactNumber = request.CustomerPhone, // Handled the mismatch!
                DeliveryAddress = request.Address,     // Handled the mismatch!
                Source = request.Source,
                Remarks = request.Remarks,
                IsTrustedCustomer = request.IsTrustedCustomer,

                // -- 💰 FINANCIAL MAPPINGS --
                Price = request.Price,   // <-- Added this to catch the 4500!
                AddOns = request.AddOns, // <-- Added this to catch any extras!
                DeliveryFee = request.DeliveryFee,
                Downpayment = request.Downpayment,
                Discount = request.Discount,      
                GrandTotal = request.GrandTotal  
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
                    order.TargetDeliveryTime,
                    order.IsTrustedCustomer,
                    order.Downpayment // <-- Pass the downpayment here!
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


        public async Task<bool> CancelOrderAsync(int orderId)
        {
            // 1. Find the master order
            var order = await _context.Orders.FindAsync(orderId);

            // 2. Protect against bad requests (order doesn't exist or is already cancelled)
            if (order == null || order.IsCancelled) return false;

            // 3. Flip the kill-switch
            order.IsCancelled = true;

            // 4. Tell the Inventory Service to free up the pig!
            await _inventoryService.ReleaseReservationAsync(orderId);

            // 5. Save everything to the SQL database
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<List<OrderDirectoryDto>> GetOrderDirectoryAsync(string? searchTerm, string? filterTab)
        {
            // 1. The Foundation: Start looking at Orders, but tell Entity Framework 
            // NOT to track changes (.AsNoTracking()). This makes read operations lightning fast!
            var query = _context.Orders.AsNoTracking().AsQueryable();

            // 2. The Search Engine: If the user typed something, filter the database rows 
            // BEFORE bringing them into memory.
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                query = query.Where(o => o.CustomerName.Contains(searchTerm));
            }

            // 3. Tab Filtering (Prep for later): 
            // For example, if (filterTab == "Upcoming") { query = query.Where(o => o.TargetDeliveryTime >= DateTime.UtcNow); }
            // We will leave this simple for now, but the hook is there!

            // 4. The Projection (N+1 Killer): Only pull the exact columns we need, directly into our DTO.
            var directory = await query
                .Select(o => new OrderDirectoryDto
                {
                    Id = o.Id,
                    CustomerName = o.CustomerName,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    TotalAmount = o.Price + o.DeliveryFee,

                    Status = o.RoutingStatus.ToString(),

                    ContactNumber = o.ContactNumber ?? string.Empty,

                    Location = o.DeliveryAddress ?? string.Empty,

                    Downpayment = o.Downpayment,

                    IsTrustedCustomer = o.IsTrustedCustomer
                })
                .OrderByDescending(o => o.TargetDeliveryTime)
                .ToListAsync();

            return directory;
        }


        public async Task UpdateOrderAsync(int id, UpdateOrderDto request)
        {
            // 1. Pull the existing order AND its nested items out of the database
            var order = await _context.Orders
                .Include(o => o.OrderItems) // We need the items to check for size changes!
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                // If some rogue ID comes through, gracefully abort.
                throw new KeyNotFoundException($"Order with ID {id} not found.");
            }

            // 2. The Trigger: Did they change the delivery time?
            bool requiresRescheduling = false;
            if (order.TargetDeliveryTime != request.TargetDeliveryTime)
            {
                requiresRescheduling = true;
            }

            // 3. Update the Master Order details
            order.CustomerName = request.CustomerName;
            order.ContactNumber = request.ContactNumber;
            order.DeliveryAddress = request.DeliveryAddress;
            order.Remarks = request.Remarks;
            order.TargetDeliveryTime = request.TargetDeliveryTime;
            order.Fulfillment = request.Fulfillment;

            order.Price = request.Price;
            order.AddOns = request.AddOns;
            order.DeliveryFee = request.DeliveryFee;
            order.Downpayment = request.Downpayment;
            order.Discount = request.Discount;     
            order.GrandTotal = request.GrandTotal; 

            // 4. Update the Items (Check if they changed the Lechon Size!)
            foreach (var requestedItem in request.Items)
            {
                var existingItem = order.OrderItems.FirstOrDefault(i => i.Id == requestedItem.Id);
                if (existingItem != null)
                {
                    if (existingItem.ItemCategoryId != requestedItem.ItemCategoryId)
                    {
                        // If they changed a Medium to a Large, we MUST recalculate the cooking time!
                        requiresRescheduling = true;
                        existingItem.ItemCategoryId = requestedItem.ItemCategoryId;
                    }
                    existingItem.Quantity = requestedItem.Quantity;
                }
            }

            // 5. THE MAGIC RULE: Automatically recalculate the kitchen timeline!
            if (requiresRescheduling)
            {
                foreach (var item in order.OrderItems)
                {
                    // Find and delete the outdated schedule
                    var oldSchedule = await _context.OrderItemSchedules
                        .FirstOrDefaultAsync(s => s.OrderItemId == item.Id);

                    if (oldSchedule != null)
                    {
                        _context.OrderItemSchedules.Remove(oldSchedule);
                    }

                    // Command the SchedulingService to generate a brand new timeline
                    var newSchedule = await _schedulingService.CalculateScheduleAsync(
                        item.Id,
                        order.TargetDeliveryTime, // The newly edited time!
                        item.ItemCategoryId       // The potentially edited size!
                    );

                    _context.OrderItemSchedules.Add(newSchedule);
                }
            }

            // 6. Save all these changes to SQL Server atomically
            await _context.SaveChangesAsync();
        }
    }
}