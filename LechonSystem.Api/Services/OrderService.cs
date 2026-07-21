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

        Task<Order> GetOrderByIdAsync(int orderId);

        Task<bool> ApplyNewMenuPricesAsync(int orderId);
        Task<bool> WaivePriceHikeAsync(int orderId);
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

                    // 🚀 THE SNAPSHOT FIX: We pull the exact price of this specific Lechon 
                    // from the frontend cart and lock it into the database row!
                    TotalPrice = itemDto.Price
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

                    IsTrustedCustomer = o.IsTrustedCustomer,
                    DeliveryAddress = o.DeliveryAddress
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

            // 4. Update the Items (Smart Synchronization)
            var incomingItemIds = request.Items.Select(i => i.Id).ToList();

            foreach (var requestedItem in request.Items)
            {
                var existingItem = order.OrderItems.FirstOrDefault(i => i.Id == requestedItem.Id);

                if (existingItem != null)
                {
                    // SCENARIO A: The item already exists. Update it!
                    if (existingItem.ItemCategoryId != requestedItem.ItemCategoryId)
                    {
                        requiresRescheduling = true;
                        existingItem.ItemCategoryId = requestedItem.ItemCategoryId;
                    }
                    existingItem.Quantity = requestedItem.Quantity;
                }
                else if (requestedItem.Id == 0)
                {
                    // SCENARIO B: Brand new item added from the React Edit Form!
                    requiresRescheduling = true; // A new pig means the kitchen needs a new schedule!

                    var newItem = new OrderItem
                    {
                        ItemCategoryId = requestedItem.ItemCategoryId,
                        Quantity = requestedItem.Quantity,
                        TotalPrice = 0
                    };

                    // Add it to the master order tracking
                    order.OrderItems.Add(newItem);
                }
            }

            // SCENARIO C: Handle Deletions (If the cashier removed a Lechon from the cart)
            var itemsToRemove = order.OrderItems
                .Where(i => !incomingItemIds.Contains(i.Id) && i.Id != 0)
                .ToList();

            if (itemsToRemove.Any())
            {
                requiresRescheduling = true;

                // Safety Step: We must delete the old schedules of the removed items first to avoid DB clashes!
                var schedulesToDelete = await _context.OrderItemSchedules
                    .Where(s => itemsToRemove.Select(item => item.Id).Contains(s.OrderItemId))
                    .ToListAsync();
                _context.OrderItemSchedules.RemoveRange(schedulesToDelete);

                _context.OrderItems.RemoveRange(itemsToRemove);
            }

            // --- 🚀 THE MAGIC FIX: THE TWO-STEP SAVE ---
            // We force C# to push the new items to SQL Server right now.
            // SQL Server will instantly replace their "0" IDs with real IDs (e.g., 49, 50)!
            await _context.SaveChangesAsync();
            // -------------------------------------------

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

                    // Because of our Two-Step Save, item.Id is no longer 0! It is now a real ID!
                    var newSchedule = await _schedulingService.CalculateScheduleAsync(
                        item.Id,
                        order.TargetDeliveryTime,
                        item.ItemCategoryId
                    );

                    _context.OrderItemSchedules.Add(newSchedule);
                }
            }

            // 6. Save the newly generated schedules!
            await _context.SaveChangesAsync();
        }


        public async Task<Order> GetOrderByIdAsync(int orderId)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.ItemCategory) // Grabs the Lechon Size Name!
                .AsNoTracking() // Makes the read lightning fast
                .FirstOrDefaultAsync(o => o.Id == orderId);

            return order;
        }



        // Action 1: Customer Agreed
        public async Task<bool> ApplyNewMenuPricesAsync(int orderId)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null) return false;

            // Mathematically increase the locked prices to match the live CMS prices
            foreach (var item in order.OrderItems)
            {
                if (item.Price < item.ItemCategory.BasePrice)
                {
                    item.Price = item.ItemCategory.BasePrice;
                    item.TotalPrice = item.Price * item.Quantity;
                }
            }

            // You would recalculate your Order Grand Total here if you have a method for it!
            await _context.SaveChangesAsync();
            return true;
        }

        // Action 2: Waive Hike
        public async Task<bool> WaivePriceHikeAsync(int orderId)
        {
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null) return false;

            // Permanently lock the old price and dismiss the alarm
            order.IsPriceWaived = true;
            await _context.SaveChangesAsync();
            return true;
        }
    }


}