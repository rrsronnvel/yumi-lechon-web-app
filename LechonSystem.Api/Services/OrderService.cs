using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Interfaces;
using LechonSystem.Api.Models.DTOs;

namespace LechonSystem.Api.Services
{
    public class OrderService : IOrderService
    {
        private readonly LechonDbContext _context;
        private readonly ISchedulingService _schedulingService;
        private readonly IInventoryService _inventoryService;
        private readonly INotificationSender _notificationSender;
        private readonly IHttpContextAccessor _httpContextAccessor;

        private string CurrentUser => _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "System";

        public OrderService(
            LechonDbContext context,
            ISchedulingService schedulingService,
            IInventoryService inventoryService,
            INotificationSender notificationSender,
            IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _schedulingService = schedulingService;
            _inventoryService = inventoryService;
            _notificationSender = notificationSender;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
        {
            var today = DateTime.UtcNow.Date;
            var todayCount = await _context.Orders.CountAsync(o => o.CreatedAt >= today && o.CreatedAt < today.AddDays(1));
            var orderReference = $"{today:MMddyy}-{(todayCount + 1):D3}";

            var effectiveDepartureTime = request.Fulfillment == FulfillmentType.Pickup
                ? request.TargetDeliveryTime
                : (request.RiderDepartureTime ?? request.TargetDeliveryTime);

            var rawContactNumber = !string.IsNullOrWhiteSpace(request.ContactNumber)
                ? request.ContactNumber
                : request.CustomerPhone;
            var normalizedPhone = CustomerService.NormalizePhoneNumber(rawContactNumber);

            var resolvedDeliveryAddress = !string.IsNullOrWhiteSpace(request.DeliveryAddress)
                ? request.DeliveryAddress
                : request.Address;

            var order = new Order
            {
                // -- Core Details --
                OrderReference = orderReference,
                CustomerName = request.CustomerName,
                FacebookName = request.FacebookName,
                TargetDeliveryTime = request.TargetDeliveryTime,
                RiderDepartureTime = effectiveDepartureTime,
                Fulfillment = request.Fulfillment,
                IsDeliveryDetailsConfirmed = false,

                // -- 🚀 NEW MAPPINGS HERE --
                ContactNumber = !string.IsNullOrWhiteSpace(normalizedPhone) ? normalizedPhone : rawContactNumber,
                DeliveryAddress = resolvedDeliveryAddress,
                Landmark = request.Landmark,
                Source = request.Source,
                EventType = request.EventType,
                Remarks = request.Remarks,
                IsTrustedCustomer = request.IsTrustedCustomer,

                // -- 💰 FINANCIAL MAPPINGS --
                Price = request.Price,
                AddOns = request.AddOns,
                DeliveryFee = request.DeliveryFee,
                Downpayment = request.Downpayment,
                Discount = request.Discount,
                GrandTotal = request.GrandTotal,
                CreatedBy = CurrentUser
            };

            if (!string.IsNullOrWhiteSpace(normalizedPhone))
            {
                var profile = await _context.CustomerProfiles
                    .FirstOrDefaultAsync(c => c.ContactNumber == normalizedPhone || c.ContactNumber == rawContactNumber);

                if (profile != null)
                {
                    profile.TotalOrdersCount += 1;
                    profile.FullName = request.CustomerName;
                    profile.FacebookName = !string.IsNullOrWhiteSpace(request.FacebookName)
                        ? request.FacebookName.Trim()
                        : profile.FacebookName;
                    profile.DefaultAddress = !string.IsNullOrWhiteSpace(resolvedDeliveryAddress)
                        ? resolvedDeliveryAddress.Trim()
                        : profile.DefaultAddress;
                    profile.DefaultLandmark = !string.IsNullOrWhiteSpace(request.Landmark)
                        ? request.Landmark.Trim()
                        : profile.DefaultLandmark;
                    profile.IsVip = request.IsTrustedCustomer || profile.IsVip;
                    profile.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    var priorOrdersCount = await _context.Orders
                        .CountAsync(o => !o.IsCancelled && (o.ContactNumber == normalizedPhone || o.ContactNumber == rawContactNumber));

                    var newProfile = new CustomerProfile
                    {
                        ContactNumber = normalizedPhone,
                        FullName = request.CustomerName,
                        FacebookName = string.IsNullOrWhiteSpace(request.FacebookName) ? null : request.FacebookName.Trim(),
                        DefaultAddress = string.IsNullOrWhiteSpace(resolvedDeliveryAddress) ? null : resolvedDeliveryAddress.Trim(),
                        DefaultLandmark = string.IsNullOrWhiteSpace(request.Landmark) ? null : request.Landmark.Trim(),
                        IsVip = request.IsTrustedCustomer,
                        TotalOrdersCount = priorOrdersCount + 1,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.CustomerProfiles.Add(newProfile);
                }
            }

            var categoryIds = request.Items.Select(i => i.ItemCategoryId).Distinct().ToList();
            var categories = await _context.ItemCategories
                .Where(c => categoryIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c);

            foreach (var itemDto in request.Items)
            {
                if (!categories.TryGetValue(itemDto.ItemCategoryId, out var category))
                {
                    throw new InvalidOperationException($"Category with ID {itemDto.ItemCategoryId} not found.");
                }

                var orderItem = new OrderItem
                {
                    ItemCategoryId = itemDto.ItemCategoryId,
                    Quantity = itemDto.Quantity,
                    Price = category.BasePrice,
                    TotalPrice = category.BasePrice * itemDto.Quantity
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
                    savedItem.ItemCategoryId,
                    order.RiderDepartureTime
                );

                _context.OrderItemSchedules.Add(calculatedSchedule);

                await _inventoryService.CreatePendingReservationAsync(
                    order.Id,
                    savedItem.ItemCategoryId,
                    order.TargetDeliveryTime,
                    order.IsTrustedCustomer,
                    order.Downpayment
                );
            }

            var auditLog = new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Order Created",
                Changes = $"Order #{order.OrderReference} created for {order.CustomerName} (Total: ₱{order.GrandTotal:N2})",
                ChangedBy = CurrentUser,
                Timestamp = DateTime.UtcNow
            };
            _context.OrderAuditLogs.Add(auditLog);

            await _context.SaveChangesAsync();
            return order;
        }

        public async Task<bool> ConfirmPaymentAsync(int orderId)
        {
            var reservation = await _context.InventoryReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId);

            if (reservation == null) return false;

            reservation.ReservationStatus = ReservationStatus.Committed;

            var order = await _context.Orders.FindAsync(orderId);
            if (order == null) return false;

            string customerPhone = order.ContactNumber;
            string message = $"Hi {order.CustomerName}, your downpayment for your Yumi's Lechon booking has been verified! Your lechon reservation is now locked in. 🐷";

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

        public async Task<bool> ConfirmDeliveryDetailsAsync(int orderId)
        {
            var order = await _context.Orders.FindAsync(orderId);

            if (order == null) return false;

            order.IsDeliveryDetailsConfirmed = true;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> CancelOrderAsync(int orderId, string reason = "Cancelled by dispatcher")
        {
            // 1. Find the master order
            var order = await _context.Orders.FindAsync(orderId);

            // 2. Protect against bad requests (order doesn't exist or is already cancelled)
            if (order == null || order.IsCancelled) return false;

            // 3. Flip the kill-switch
            order.IsCancelled = true;
            order.CancellationReason = reason;
            order.UpdatedAt = DateTime.UtcNow;

            // 4. Release/cancel all linked InventoryReservations
            var reservations = await _context.InventoryReservations
                .Where(r => r.OrderId == orderId)
                .ToListAsync();

            foreach (var res in reservations)
            {
                res.IsCancelled = true;
                res.Status = ReservationStatus.Cancelled;
                res.ReservationStatus = ReservationStatus.Cancelled;
            }

            var auditLog = new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Order Cancelled",
                Changes = $"Order cancelled. Reason: {reason}",
                ChangedBy = CurrentUser,
                Timestamp = DateTime.UtcNow
            };
            _context.OrderAuditLogs.Add(auditLog);

            // 5. Save everything to the SQL database
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<List<OrderDirectoryDto>> GetOrderDirectoryAsync(string? searchTerm, string? filterTab)
        {
            var query = _context.Orders.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                var term = searchTerm.Trim().TrimStart('#');
                query = query.Where(o => 
                    o.CustomerName.Contains(term) ||
                    (o.FacebookName != null && o.FacebookName.Contains(term)) ||
                    o.OrderReference.Contains(term) ||
                    o.ContactNumber.Contains(term) ||
                    o.Id.ToString().Contains(term));
            }

            var tab = (filterTab ?? "upcoming").Trim().ToLowerInvariant();
            switch (tab)
            {
                case "recent":
                    var cutoff = DateTime.UtcNow.AddHours(-48);
                    query = query.Where(o => 
                        (o.UpdatedAt.HasValue && o.UpdatedAt.Value >= cutoff) ||
                        _context.OrderAuditLogs.Any(a => a.OrderId == o.Id && a.Timestamp >= cutoff));
                    query = query.OrderByDescending(o => o.UpdatedAt ?? o.CreatedAt);
                    break;

                case "balance-due":
                    query = query.Where(o => (o.GrandTotal - o.Downpayment) > 0 && !o.IsCancelled);
                    query = query.OrderBy(o => o.TargetDeliveryTime);
                    break;

                case "past-30":
                    var past30Cutoff = DateTime.Today.AddDays(-30);
                    var today = DateTime.Today;
                    query = query.Where(o => o.TargetDeliveryTime < today && o.TargetDeliveryTime >= past30Cutoff && !o.IsCancelled);
                    query = query.OrderByDescending(o => o.TargetDeliveryTime);
                    break;

                case "cancelled":
                    query = query.Where(o => o.IsCancelled == true);
                    query = query.OrderByDescending(o => o.UpdatedAt ?? o.CreatedAt);
                    break;

                case "all":
                case "all-time":
                    query = query.OrderByDescending(o => o.TargetDeliveryTime);
                    break;

                case "upcoming":
                default:
                    var upcomingToday = DateTime.Today;
                    query = query.Where(o => o.TargetDeliveryTime >= upcomingToday && !o.IsCancelled);
                    query = query.OrderBy(o => o.TargetDeliveryTime);
                    break;
            }

            var recentCutoff = DateTime.UtcNow.AddHours(-48);

            var directory = await query
                .Select(o => new OrderDirectoryDto
                {
                    Id = o.Id,
                    OrderReference = o.OrderReference,
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    ContactNumber = o.ContactNumber ?? string.Empty,
                    Source = o.Source ?? string.Empty,
                    EventType = o.EventType,
                    DeliveryAddress = o.DeliveryAddress ?? string.Empty,
                    Landmark = o.Landmark,
                    Fulfillment = (int)o.Fulfillment,
                    RoutingStatus = o.RoutingStatus.ToString(),
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    RiderDepartureTime = o.RiderDepartureTime,
                    GrandTotal = o.GrandTotal,
                    Downpayment = o.Downpayment,
                    BalanceDue = (o.GrandTotal - o.Downpayment) > 0 ? (o.GrandTotal - o.Downpayment) : 0,
                    IsTrustedCustomer = o.IsTrustedCustomer,
                    IsCancelled = o.IsCancelled,
                    CancellationReason = o.CancellationReason,
                    CreatedBy = o.CreatedBy,
                    UpdatedAt = o.UpdatedAt,
                    HasRecentEdits = o.UpdatedAt.HasValue && o.UpdatedAt.Value >= recentCutoff,
                    SettlementCustodyStatus = o.SettlementCustodyStatus ?? "Uncollected",
                    IsRemittedToOwner = o.SettlementCustodyStatus == "Settled",
                    RiderName = o.DeliveryTrip != null ? o.DeliveryTrip.RiderName : o.RiderSignedBy
                })
                .ToListAsync();

            return directory;
        }

        public async Task UpdateOrderAsync(int id, UpdateOrderDto request)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.ItemCategory)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                throw new KeyNotFoundException($"Order with ID {id} not found.");
            }

            var auditChanges = new List<string>();

            var effectiveRiderDepartureTime = request.Fulfillment == FulfillmentType.Pickup
                ? request.TargetDeliveryTime
                : (request.RiderDepartureTime ?? order.RiderDepartureTime ?? request.TargetDeliveryTime);

            // --- Tracking ALL Master Order Fields ---
            if (order.CustomerName != request.CustomerName)
                auditChanges.Add($"Customer Name changed from '{order.CustomerName}' to '{request.CustomerName}'");

            if ((order.FacebookName ?? string.Empty) != (request.FacebookName ?? string.Empty))
                auditChanges.Add($"FB Name changed from '{order.FacebookName}' to '{request.FacebookName}'");

            if (order.ContactNumber != request.ContactNumber)
                auditChanges.Add($"Contact changed from '{order.ContactNumber}' to '{request.ContactNumber}'");

            if (!string.IsNullOrWhiteSpace(request.Source) && order.Source != request.Source)
                auditChanges.Add($"Source changed from '{order.Source}' to '{request.Source}'");

            if ((order.EventType ?? string.Empty) != (request.EventType ?? string.Empty))
                auditChanges.Add($"Event Type changed from '{order.EventType}' to '{request.EventType}'");

            if ((order.Landmark ?? string.Empty) != (request.Landmark ?? string.Empty))
                auditChanges.Add($"Landmark changed from '{order.Landmark}' to '{request.Landmark}'");

            if (order.AddOns != request.AddOns)
                auditChanges.Add($"Add-Ons changed from '{order.AddOns}' to '{request.AddOns}'");

            if (order.Remarks != request.Remarks)
                auditChanges.Add($"Remarks changed from '{order.Remarks}' to '{request.Remarks}'");

            if (order.Discount != request.Discount)
                auditChanges.Add($"Discount changed from ₱{order.Discount} to ₱{request.Discount}");

            if (order.TargetDeliveryTime != request.TargetDeliveryTime)
                auditChanges.Add($"Delivery Time changed from {order.TargetDeliveryTime:MMM dd, yyyy h:mm tt} to {request.TargetDeliveryTime:MMM dd, yyyy h:mm tt}");

            if (order.RiderDepartureTime != effectiveRiderDepartureTime)
                auditChanges.Add($"Rider Departure Time changed from {(order.RiderDepartureTime.HasValue ? order.RiderDepartureTime.Value.ToString("MMM dd, yyyy h:mm tt") : "None")} to {effectiveRiderDepartureTime:MMM dd, yyyy h:mm tt}");

            if (order.Fulfillment != request.Fulfillment)
                auditChanges.Add($"Fulfillment changed from '{order.Fulfillment}' to '{request.Fulfillment}'");

            if (order.DeliveryAddress != request.DeliveryAddress)
                auditChanges.Add($"Address changed from '{order.DeliveryAddress}' to '{request.DeliveryAddress}'");

            if (order.DeliveryFee != request.DeliveryFee)
                auditChanges.Add($"Delivery Fee changed from ₱{order.DeliveryFee} to ₱{request.DeliveryFee}");

            if (order.Price != request.Price)
                auditChanges.Add($"Lechon Subtotal changed from ₱{order.Price} to ₱{request.Price}");

            bool requiresRescheduling = false;
            if (order.TargetDeliveryTime != request.TargetDeliveryTime || order.RiderDepartureTime != effectiveRiderDepartureTime)
            {
                requiresRescheduling = true;
            }

            // Overwrite Master Order details
            order.CustomerName = request.CustomerName;
            order.FacebookName = request.FacebookName;
            order.ContactNumber = request.ContactNumber;
            if (!string.IsNullOrWhiteSpace(request.Source))
            {
                order.Source = request.Source;
            }
            order.EventType = request.EventType;
            order.DeliveryAddress = request.DeliveryAddress;
            order.Landmark = request.Landmark;
            order.Remarks = request.Remarks;
            order.TargetDeliveryTime = request.TargetDeliveryTime;
            order.RiderDepartureTime = effectiveRiderDepartureTime;
            order.Fulfillment = request.Fulfillment;
            order.Price = request.Price;
            order.AddOns = request.AddOns;
            order.DeliveryFee = request.DeliveryFee;
            order.Downpayment = request.Downpayment;
            order.Discount = request.Discount;
            order.GrandTotal = request.GrandTotal;
            order.UpdatedAt = DateTime.UtcNow;

            // --- Highly Detailed Item Tracking ---
            var incomingItemIds = request.Items.Select(i => i.Id).ToList();

            foreach (var requestedItem in request.Items)
            {
                var existingItem = order.OrderItems.FirstOrDefault(i => i.Id == requestedItem.Id);

                if (existingItem != null)
                {
                    if (existingItem.ItemCategoryId != requestedItem.ItemCategoryId || existingItem.Quantity != requestedItem.Quantity)
                    {
                        requiresRescheduling = true;

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

                        existingItem.ItemCategoryId = requestedItem.ItemCategoryId;
                        existingItem.Quantity = requestedItem.Quantity;

                        existingItem.Price = newCat?.BasePrice ?? 0;
                        existingItem.TotalPrice = (newCat?.BasePrice ?? 0) * requestedItem.Quantity;
                    }
                }
                else if (requestedItem.Id == 0)
                {
                    requiresRescheduling = true;

                    var newCat = await _context.ItemCategories.FindAsync(requestedItem.ItemCategoryId);
                    string newName = newCat?.Name ?? "Item";

                    auditChanges.Add($"Added {requestedItem.Quantity}x {newName} to the order");

                    var newItem = new OrderItem
                    {
                        ItemCategoryId = requestedItem.ItemCategoryId,
                        Quantity = requestedItem.Quantity,
                        Price = newCat?.BasePrice ?? 0,
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

            // Recalculate kitchen timeline for non-overridden items
            if (requiresRescheduling)
            {
                foreach (var item in order.OrderItems)
                {
                    var oldSchedule = await _context.OrderItemSchedules
                        .FirstOrDefaultAsync(s => s.OrderItemId == item.Id);

                    if (oldSchedule != null && oldSchedule.IsManualOverride)
                    {
                        oldSchedule.TargetDeliveryTime = order.TargetDeliveryTime;
                        continue;
                    }

                    if (oldSchedule != null) _context.OrderItemSchedules.Remove(oldSchedule);

                    var newSchedule = await _schedulingService.CalculateScheduleAsync(
                        item.Id,
                        order.TargetDeliveryTime,
                        item.ItemCategoryId,
                        order.RiderDepartureTime);

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
                    ChangedBy = CurrentUser,
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

        public async Task<Order?> GetOrderByIdAsync(int orderId)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.ItemCategory)
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == orderId);

            return order;
        }

        public async Task<OrderDetailsDto?> GetOrderDetailsAsync(int orderId)
        {
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.ItemCategory)
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null) return null;

            var dto = new OrderDetailsDto
            {
                Id = order.Id,
                OrderReference = order.OrderReference,
                CustomerName = order.CustomerName,
                FacebookName = order.FacebookName,
                ContactNumber = order.ContactNumber ?? string.Empty,
                Source = order.Source ?? string.Empty,
                EventType = order.EventType,
                DeliveryAddress = order.DeliveryAddress ?? string.Empty,
                Landmark = order.Landmark,
                Remarks = order.Remarks,
                Price = order.Price,
                AddOns = order.AddOns,
                DeliveryFee = order.DeliveryFee,
                Downpayment = order.Downpayment,
                Discount = order.Discount,
                GrandTotal = order.GrandTotal,
                BalanceDue = (order.GrandTotal - order.Downpayment) > 0 ? (order.GrandTotal - order.Downpayment) : 0,
                IsTrustedCustomer = order.IsTrustedCustomer,
                TargetDeliveryTime = order.TargetDeliveryTime,
                RiderDepartureTime = order.RiderDepartureTime,
                IsDeliveryDetailsConfirmed = order.IsDeliveryDetailsConfirmed,
                IsCancelled = order.IsCancelled,
                CancellationReason = order.CancellationReason,
                IsPriceWaived = order.IsPriceWaived,
                CreatedBy = order.CreatedBy,
                CreatedAt = order.CreatedAt,
                UpdatedAt = order.UpdatedAt,
                Fulfillment = (int)order.Fulfillment,
                RoutingStatus = order.RoutingStatus.ToString(),
                DeliveryTripId = order.DeliveryTripId,
                SettlementCustodyStatus = order.SettlementCustodyStatus ?? "Uncollected",
                OrderItems = order.OrderItems.Select(i => new OrderDetailItemDto
                {
                    Id = i.Id,
                    OrderId = i.OrderId,
                    ItemCategoryId = i.ItemCategoryId,
                    Quantity = i.Quantity,
                    Price = i.Price,
                    TotalPrice = i.TotalPrice,
                    ItemCategory = i.ItemCategory == null ? null : new OrderDetailCategoryDto
                    {
                        Id = i.ItemCategory.Id,
                        Name = i.ItemCategory.Name,
                        BasePrice = i.ItemCategory.BasePrice,
                        MinimumWeightKg = i.ItemCategory.MinimumWeightKg,
                        MaximumWeightKg = i.ItemCategory.MaximumWeightKg
                    }
                }).ToList()
            };

            var trip = order.DeliveryTripId.HasValue
                ? await _context.DeliveryTrips.AsNoTracking().FirstOrDefaultAsync(t => t.Id == order.DeliveryTripId.Value)
                : await _context.DeliveryTrips.AsNoTracking().FirstOrDefaultAsync(t => t.Orders.Any(o => o.Id == orderId));

            if (trip != null)
            {
                dto.AssignedRiderName = trip.RiderName;
                var rider = await _context.Riders
                    .AsNoTracking()
                    .FirstOrDefaultAsync(r => r.FullName == trip.RiderName);
                dto.AssignedRiderPhone = rider?.PhoneNumber;
            }

            var normalizedOrderPhone = CustomerService.NormalizePhoneNumber(order.ContactNumber);
            if (!string.IsNullOrWhiteSpace(normalizedOrderPhone))
            {
                var customerProfile = await _context.CustomerProfiles
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.ContactNumber == normalizedOrderPhone || c.ContactNumber == order.ContactNumber);

                if (customerProfile != null)
                {
                    dto.CustomerProfileId = customerProfile.Id;
                    dto.CustomerTotalOrdersCount = Math.Max(1, customerProfile.TotalOrdersCount);
                    dto.CustomerPreferences = customerProfile.Preferences;
                    dto.CustomerComplaintHistory = customerProfile.ComplaintHistory;
                }
                else
                {
                    var count = await _context.Orders
                        .AsNoTracking()
                        .CountAsync(o => !o.IsCancelled && (o.ContactNumber == normalizedOrderPhone || o.ContactNumber == order.ContactNumber));
                    dto.CustomerTotalOrdersCount = Math.Max(1, count);
                }
            }
            else
            {
                dto.CustomerTotalOrdersCount = 1;
            }

            return dto;
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

            foreach (var item in order.OrderItems)
            {
                var newLivePrice = item.ItemCategory?.BasePrice ?? 0;
                var newLiveTotal = newLivePrice * item.Quantity;

                if (item.TotalPrice < newLiveTotal)
                {
                    totalIncrease += (newLiveTotal - item.TotalPrice);

                    item.TotalPrice = newLiveTotal; 
                    item.Price = newLivePrice;
                }
            }

            if (totalIncrease > 0)
            {
                order.Price += totalIncrease;
                order.GrandTotal += totalIncrease;
            }

            order.IsPriceWaived = true; 

            await _context.SaveChangesAsync();
            return true;
        }

        // Action 2: Waive Hike
        public async Task<bool> WaivePriceHikeAsync(int orderId)
        {
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null) return false;

            order.IsPriceWaived = true;
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
