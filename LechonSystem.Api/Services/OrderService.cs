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

        Task<List<OrderAuditLog>> GetOrderAuditLogsAsync(int orderId);
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
                // 🚀 THE SNAPSHOT FIX: We actively look up the live CMS price at checkout
                // and lock it into the database so it never saves as 0 again!
                var category = await _context.ItemCategories.FindAsync(itemDto.ItemCategoryId);
                var lockedPrice = (category?.BasePrice ?? 0) * itemDto.Quantity;

                var orderItem = new OrderItem
                {
                    ItemCategoryId = itemDto.ItemCategoryId,
                    Quantity = itemDto.Quantity,
                    TotalPrice = lockedPrice
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
                    DeliveryAddress = o.DeliveryAddress,

                    Fulfillment = (int)o.Fulfillment
                })
                .OrderByDescending(o => o.TargetDeliveryTime)
                .ToListAsync();

            return directory;
        }


        public async Task UpdateOrderAsync(int id, UpdateOrderDto request)
        {
            // 1. We added .ThenInclude() here! This acts as our dictionary to get the exact Lechon Name.
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.ItemCategory)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                throw new KeyNotFoundException($"Order with ID {id} not found.");
            }

            var auditChanges = new List<string>();

            // --- NEW: Tracking ALL Master Order Fields ---
            if (order.CustomerName != request.CustomerName)
                auditChanges.Add($"Customer Name changed from '{order.CustomerName}' to '{request.CustomerName}'");

            if (order.ContactNumber != request.ContactNumber)
                auditChanges.Add($"Contact changed from '{order.ContactNumber}' to '{request.ContactNumber}'");

            if (order.AddOns != request.AddOns)
                auditChanges.Add($"Add-Ons changed from '{order.AddOns}' to '{request.AddOns}'");

            if (order.Remarks != request.Remarks)
                auditChanges.Add($"Remarks changed from '{order.Remarks}' to '{request.Remarks}'");

            if (order.Discount != request.Discount)
                auditChanges.Add($"Discount changed from ₱{order.Discount} to ₱{request.Discount}");

            if (order.TargetDeliveryTime != request.TargetDeliveryTime)
                auditChanges.Add($"Delivery Time changed from {order.TargetDeliveryTime:MMM dd, yyyy h:mm tt} to {request.TargetDeliveryTime:MMM dd, yyyy h:mm tt}");

            if (order.DeliveryAddress != request.DeliveryAddress)
                auditChanges.Add($"Address changed from '{order.DeliveryAddress}' to '{request.DeliveryAddress}'");

            if (order.DeliveryFee != request.DeliveryFee)
                auditChanges.Add($"Delivery Fee changed from ₱{order.DeliveryFee} to ₱{request.DeliveryFee}");

            if (order.Price != request.Price)
                auditChanges.Add($"Lechon Subtotal changed from ₱{order.Price} to ₱{request.Price}");


            bool requiresRescheduling = false;
            if (order.TargetDeliveryTime != request.TargetDeliveryTime)
            {
                requiresRescheduling = true;
            }

            // Overwrite Master Order details
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

            // --- NEW: Highly Detailed Item Tracking ---
            var incomingItemIds = request.Items.Select(i => i.Id).ToList();

            foreach (var requestedItem in request.Items)
            {
                var existingItem = order.OrderItems.FirstOrDefault(i => i.Id == requestedItem.Id);

                if (existingItem != null)
                {
                    if (existingItem.ItemCategoryId != requestedItem.ItemCategoryId || existingItem.Quantity != requestedItem.Quantity)
                    {
                        requiresRescheduling = true;

                        // Fetch the new category from the database
                        var newCat = await _context.ItemCategories.FindAsync(requestedItem.ItemCategoryId);
                        string oldName = existingItem.ItemCategory?.Name ?? "Unknown Size";
                        string newName = newCat?.Name ?? "Unknown Size";

                        if (existingItem.ItemCategoryId != requestedItem.ItemCategoryId)
                            auditChanges.Add($"Item changed from {oldName} to {newName}");

                        if (existingItem.Quantity != requestedItem.Quantity)
                        {
                            string itemName = existingItem.ItemCategory?.Name ?? "Item";
                            auditChanges.Add($"{itemName} quantity changed from {existingItem.Quantity} to {requestedItem.Quantity}");
                        }

                        // Apply the updates
                        existingItem.ItemCategoryId = requestedItem.ItemCategoryId;
                        existingItem.Quantity = requestedItem.Quantity;

                        // 🚀 THE FIX: Update the snapshot price!
                        existingItem.TotalPrice = (newCat?.BasePrice ?? 0) * requestedItem.Quantity;
                    }
                }
                else if (requestedItem.Id == 0)
                {
                    requiresRescheduling = true;

                    // Look up the name and price of the new item they just added
                    var newCat = await _context.ItemCategories.FindAsync(requestedItem.ItemCategoryId);
                    string newName = newCat?.Name ?? "Item";

                    auditChanges.Add($"Added {requestedItem.Quantity}x {newName} to the order");

                    var newItem = new OrderItem
                    {
                        ItemCategoryId = requestedItem.ItemCategoryId,
                        Quantity = requestedItem.Quantity,
                        // 🚀 THE FIX: Lock the price snapshot for newly added items so it doesn't save as 0!
                        TotalPrice = (newCat?.BasePrice ?? 0) * requestedItem.Quantity
                    };
                    order.OrderItems.Add(newItem);
                }
            }

            // SCENARIO C: Handle Deletions with Detail
            var itemsToRemove = order.OrderItems
                .Where(i => !incomingItemIds.Contains(i.Id) && i.Id != 0)
                .ToList();

            if (itemsToRemove.Any())
            {
                requiresRescheduling = true;

                foreach (var removedItem in itemsToRemove)
                {
                    string itemName = removedItem.ItemCategory?.Name ?? "Item";
                    auditChanges.Add($"Removed {removedItem.Quantity}x {itemName} from the order");
                }

                var schedulesToDelete = await _context.OrderItemSchedules
                    .Where(s => itemsToRemove.Select(item => item.Id).Contains(s.OrderItemId))
                    .ToListAsync();
                _context.OrderItemSchedules.RemoveRange(schedulesToDelete);
                _context.OrderItems.RemoveRange(itemsToRemove);
            }

            await _context.SaveChangesAsync();

            // Recalculate kitchen timeline
            if (requiresRescheduling)
            {
                foreach (var item in order.OrderItems)
                {
                    var oldSchedule = await _context.OrderItemSchedules
                        .FirstOrDefaultAsync(s => s.OrderItemId == item.Id);

                    if (oldSchedule != null) _context.OrderItemSchedules.Remove(oldSchedule);

                    var newSchedule = await _schedulingService.CalculateScheduleAsync(
                        item.Id, order.TargetDeliveryTime, item.ItemCategoryId);

                    _context.OrderItemSchedules.Add(newSchedule);
                }
            }

            // Save the highly-detailed Black Box record!
            if (auditChanges.Any())
            {
                var auditLog = new OrderAuditLog
                {
                    OrderId = order.Id,
                    ActionType = "Order Edited",
                    Changes = string.Join(" | ", auditChanges),
                    ChangedBy = "Admin",
                    Timestamp = DateTime.UtcNow
                };
                _context.OrderAuditLogs.Add(auditLog);
            }

            await _context.SaveChangesAsync();
        }

        public async Task<List<OrderAuditLog>> GetOrderAuditLogsAsync(int orderId)
        {
            return await _context.OrderAuditLogs
                .Where(log => log.OrderId == orderId)
                .OrderByDescending(log => log.Timestamp)
                .ToListAsync();
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

            decimal totalIncrease = 0;

            // Mathematically increase the locked prices to match the live CMS prices
            foreach (var item in order.OrderItems)
            {
                // Calculate what the exact total SHOULD be today
                var newLivePrice = item.ItemCategory?.BasePrice ?? 0;
                var newLiveTotal = newLivePrice * item.Quantity;

                // If the old locked snapshot is cheaper, calculate the difference
                if (item.TotalPrice < newLiveTotal)
                {
                    totalIncrease += (newLiveTotal - item.TotalPrice);

                    // Update the item's individual receipt to the new higher price
                    item.TotalPrice = newLiveTotal; 
                    
                    // Note: If your OrderItem model also has a 'Price' property, uncomment the line below:
                    // item.Price = newLivePrice;
                }
            }

            // 🚀 THE FIX: Apply the exact price hike difference to the Master Order!
            if (totalIncrease > 0)
            {
                order.Price += totalIncrease;      // Updates the Lechon Subtotal
                order.GrandTotal += totalIncrease; // Updates the Grand Total (which instantly fixes Balance to Collect!)
            }

            // 🚀 THE DASHBOARD KILL-SWITCH: Explicitly flag this renegotiation as "Resolved" 
            // This guarantees it drops off the Dashboard table!
            order.IsPriceWaived = true; 

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