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
            var isOwner = _httpContextAccessor.HttpContext?.User.IsInRole("Owner") ?? false;
            var isOwnerConfirmed = request.IsDraft || isOwner;
            var downpaymentMethod = request.Downpayment > 0
                ? PaymentChannels.Normalize(request.DownpaymentMethod, "GCash")
                : "None";
            var today = DateTime.UtcNow.Date;
            var todayCount = await _context.Orders.CountAsync(o => o.CreatedAt >= today && o.CreatedAt < today.AddDays(1));
            var orderReference = $"{today:MMddyy}-{(todayCount + 1):D3}";

            DateTime? effectiveDepartureTime = null;
            if (request.TargetDeliveryTime.HasValue)
            {
                effectiveDepartureTime = request.Fulfillment == FulfillmentType.Pickup
                    ? request.TargetDeliveryTime
                    : (request.RiderDepartureTime ?? request.TargetDeliveryTime);
            }
            else
            {
                effectiveDepartureTime = request.RiderDepartureTime;
            }

            var rawContactNumber = !string.IsNullOrWhiteSpace(request.ContactNumber)
                ? request.ContactNumber.Trim()
                : (request.CustomerPhone ?? string.Empty).Trim();
            var rawPrimaryPhone = CustomerService.ExtractPrimaryContactNumber(rawContactNumber);
            var normalizedPhone = CustomerService.NormalizePhoneNumber(rawContactNumber);

            var resolvedDeliveryAddress = !string.IsNullOrWhiteSpace(request.DeliveryAddress)
                ? request.DeliveryAddress
                : request.Address;

            var order = new Order
            {
                // -- Core Details --
                OrderReference = orderReference,
                IsDraft = request.IsDraft,
                CustomerName = request.CustomerName,
                FacebookName = request.FacebookName,
                TargetDeliveryTime = request.TargetDeliveryTime,
                RiderDepartureTime = effectiveDepartureTime,
                Fulfillment = request.Fulfillment,
                IsDeliveryDetailsConfirmed = false,

                // -- 🚀 NEW MAPPINGS HERE --
                ContactNumber = rawContactNumber,
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
                DownpaymentMethod = downpaymentMethod,
                FreebiesSummary = request.FreebiesSummary,
                FreebiesConfigJson = request.FreebiesConfigJson,
                IsOwnerConfirmed = isOwnerConfirmed,
                OwnerConfirmedAt = isOwnerConfirmed ? DateTime.UtcNow : null,
                OwnerConfirmedBy = isOwnerConfirmed ? CurrentUser : null,
                Discount = request.Discount,
                GrandTotal = request.GrandTotal,
                CreatedBy = CurrentUser
            };

            if (!string.IsNullOrWhiteSpace(normalizedPhone))
            {
                var profile = await _context.CustomerProfiles
                    .FirstOrDefaultAsync(c => c.ContactNumber == normalizedPhone || c.ContactNumber == rawPrimaryPhone);

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
                        .CountAsync(o => !o.IsCancelled && (o.ContactNumber.Contains(normalizedPhone) || o.ContactNumber.Contains(rawPrimaryPhone)));

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

            if (order.Downpayment > 0)
            {
                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = $"ORDER_DP_{order.Id}_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}",
                    Provider = PaymentChannels.ToProvider(order.DownpaymentMethod),
                    PaymentMethod = order.DownpaymentMethod,
                    Amount = order.Downpayment,
                    Status = PaymentStatus.Success
                });
            }

            if (!order.IsDraft && order.TargetDeliveryTime.HasValue)
            {
                foreach (var savedItem in order.OrderItems)
                {
                    if (categories.TryGetValue(savedItem.ItemCategoryId, out var cat) && cat.MinimumWeightKg <= 0)
                    {
                        continue; // Exclude add-ons from kitchen schedules and freezer reservations
                    }

                    var calculatedSchedule = await _schedulingService.CalculateScheduleAsync(
                        savedItem.Id,
                        order.TargetDeliveryTime.Value,
                        savedItem.ItemCategoryId,
                        order.RiderDepartureTime
                    );

                    _context.OrderItemSchedules.Add(calculatedSchedule);

                    await _inventoryService.CreatePendingReservationAsync(
                        order.Id,
                        savedItem.ItemCategoryId,
                        order.TargetDeliveryTime.Value,
                        order.IsTrustedCustomer,
                        order.Downpayment
                    );
                }
            }

            var auditLog = new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = order.IsDraft ? "Draft Created" : "Order Created",
                Changes = order.IsDraft
                    ? $"Draft inquiry #{order.OrderReference} created for {order.CustomerName} (Est. Total: ₱{order.GrandTotal:N2})"
                    : $"Order #{order.OrderReference} created for {order.CustomerName} (Total: ₱{order.GrandTotal:N2})",
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

        public async Task<bool> ConfirmOrderByOwnerAsync(int orderId, string ownerUsername)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null || order.IsCancelled) return false;

            var confirmedBy = string.IsNullOrWhiteSpace(ownerUsername) ? CurrentUser : ownerUsername.Trim();
            order.IsOwnerConfirmed = true;
            order.OwnerConfirmedAt = DateTime.UtcNow;
            order.OwnerConfirmedBy = confirmedBy;
            order.UpdatedAt = DateTime.UtcNow;

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Owner Confirmation",
                Changes = $"Order verified and confirmed by Owner ({confirmedBy})",
                ChangedBy = confirmedBy,
                Timestamp = DateTime.UtcNow
            });

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
                case "drafts":
                    query = query.Where(o => o.IsDraft && !o.IsCancelled);
                    query = query.OrderByDescending(o => o.UpdatedAt ?? o.CreatedAt);
                    break;

                case "recent":
                    var cutoff = DateTime.UtcNow.AddHours(-48);
                    query = query.Where(o => 
                        !o.IsDraft &&
                        ((o.UpdatedAt.HasValue && o.UpdatedAt.Value >= cutoff) ||
                        _context.OrderAuditLogs.Any(a => a.OrderId == o.Id && a.Timestamp >= cutoff)));
                    query = query.OrderByDescending(o => o.UpdatedAt ?? o.CreatedAt);
                    break;

                case "balance-due":
                    query = query.Where(o => !o.IsDraft && !o.IsCancelled && (o.GrandTotal - o.Downpayment) > 0);
                    query = query.OrderBy(o => o.TargetDeliveryTime);
                    break;

                case "past-30":
                    var past30Cutoff = DateTime.Today.AddDays(-30);
                    var today = DateTime.Today;
                    query = query.Where(o => !o.IsDraft && !o.IsCancelled && o.TargetDeliveryTime != null && o.TargetDeliveryTime < today && o.TargetDeliveryTime >= past30Cutoff);
                    query = query.OrderByDescending(o => o.TargetDeliveryTime);
                    break;

                case "cancelled":
                    query = query.Where(o => o.IsCancelled == true);
                    query = query.OrderByDescending(o => o.UpdatedAt ?? o.CreatedAt);
                    break;

                case "all":
                case "all-time":
                    query = query.Where(o => !o.IsDraft);
                    query = query.OrderByDescending(o => o.TargetDeliveryTime);
                    break;

                case "upcoming":
                default:
                    var upcomingToday = DateTime.Today;
                    query = query.Where(o => !o.IsDraft && !o.IsCancelled && o.TargetDeliveryTime != null && o.TargetDeliveryTime >= upcomingToday);
                    query = query.OrderBy(o => o.TargetDeliveryTime);
                    break;
            }

            var recentCutoff = DateTime.UtcNow.AddHours(-48);

            var directory = await query
                .Select(o => new OrderDirectoryDto
                {
                    Id = o.Id,
                    OrderReference = o.OrderReference,
                    IsDraft = o.IsDraft,
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    ContactNumber = o.ContactNumber ?? string.Empty,
                    Source = o.Source ?? string.Empty,
                    EventType = o.EventType,
                    DeliveryAddress = o.DeliveryAddress,
                    Landmark = o.Landmark,
                    Remarks = o.Remarks,
                    Fulfillment = (int)o.Fulfillment,
                    RoutingStatus = o.RoutingStatus.ToString(),
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    RiderDepartureTime = o.RiderDepartureTime,
                    GrandTotal = o.GrandTotal,
                    Downpayment = o.Downpayment,
                    DownpaymentMethod = o.DownpaymentMethod,
                    FreebiesSummary = o.FreebiesSummary,
                    FreebiesConfigJson = o.FreebiesConfigJson,
                    BalanceDue = (o.GrandTotal - o.Downpayment) > 0 ? (o.GrandTotal - o.Downpayment) : 0,
                    IsTrustedCustomer = o.IsTrustedCustomer,
                    IsCancelled = o.IsCancelled,
                    CancellationReason = o.CancellationReason,
                    CreatedBy = o.CreatedBy,
                    UpdatedAt = o.UpdatedAt,
                    HasRecentEdits = o.UpdatedAt.HasValue && o.UpdatedAt.Value >= recentCutoff,
                    SettlementCustodyStatus = o.SettlementCustodyStatus ?? "Uncollected",
                    IsRemittedToOwner = o.SettlementCustodyStatus == "Settled",
                    RiderName = o.DeliveryTrip != null ? o.DeliveryTrip.RiderName : o.RiderSignedBy,
                    IsOwnerConfirmed = o.IsOwnerConfirmed,
                    OwnerConfirmedAt = o.OwnerConfirmedAt,
                    OwnerConfirmedBy = o.OwnerConfirmedBy
                })
                .ToListAsync();

            var directoryOrderIds = directory.Select(o => o.Id).ToList();
            var directoryPayments = await _context.PaymentLogs
                .AsNoTracking()
                .Where(p => directoryOrderIds.Contains(p.OrderId) && p.Status == PaymentStatus.Success)
                .Select(p => new { p.OrderId, p.PaymentMethod, p.Provider, p.Amount })
                .ToListAsync();

            foreach (var item in directory)
            {
                item.PaymentChannelsSummary = directoryPayments
                    .Where(p => p.OrderId == item.Id)
                    .GroupBy(p => PaymentChannels.Normalize(p.PaymentMethod, PaymentChannels.FromProvider(p.Provider)))
                    .Select(g => new PaymentChannelTotalDto
                    {
                        PaymentMethod = g.Key,
                        Amount = g.Sum(p => p.Amount)
                    })
                    .OrderBy(p => Array.IndexOf(PaymentChannels.Supported, p.PaymentMethod))
                    .ToList();

                if (item.PaymentChannelsSummary.Count == 0 && item.Downpayment > 0)
                {
                    item.PaymentChannelsSummary.Add(new PaymentChannelTotalDto
                    {
                        PaymentMethod = PaymentChannels.Normalize(item.DownpaymentMethod, "GCash"),
                        Amount = item.Downpayment
                    });
                }
            }

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

            bool wasDraft = order.IsDraft;
            bool isFinalizing = wasDraft && !request.IsDraft;
            bool staysDraft = wasDraft && request.IsDraft;
            var previousDownpayment = order.Downpayment;

            if (isFinalizing)
            {
                if (!request.TargetDeliveryTime.HasValue)
                {
                    throw new ArgumentException("Target delivery/pickup time is required to finalize order.");
                }
                if (!request.Items.Any())
                {
                    throw new ArgumentException("At least one order item is required to finalize order.");
                }
                if ((request.Fulfillment == FulfillmentType.Delivery || request.Fulfillment == FulfillmentType.Lalamove) && string.IsNullOrWhiteSpace(request.DeliveryAddress))
                {
                    throw new ArgumentException("Delivery address is required to finalize delivery/courier order.");
                }

                order.IsDraft = false;
                var isOwner = _httpContextAccessor.HttpContext?.User.IsInRole("Owner") ?? false;
                order.IsOwnerConfirmed = isOwner;
                order.OwnerConfirmedAt = isOwner ? DateTime.UtcNow : null;
                order.OwnerConfirmedBy = isOwner ? CurrentUser : null;
                auditChanges.Add($"Draft inquiry finalized and locked into production by {CurrentUser}");
            }
            else if (staysDraft)
            {
                order.IsDraft = true;
            }

            var effectiveRiderDepartureTime = request.TargetDeliveryTime.HasValue
                ? (request.Fulfillment == FulfillmentType.Pickup
                    ? request.TargetDeliveryTime
                    : (request.RiderDepartureTime ?? order.RiderDepartureTime ?? request.TargetDeliveryTime))
                : (request.RiderDepartureTime ?? order.RiderDepartureTime);

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
            {
                var oldTime = order.TargetDeliveryTime.HasValue ? order.TargetDeliveryTime.Value.ToString("MMM dd, yyyy h:mm tt") : "Unset";
                var newTime = request.TargetDeliveryTime.HasValue ? request.TargetDeliveryTime.Value.ToString("MMM dd, yyyy h:mm tt") : "Unset";
                auditChanges.Add($"Delivery Time changed from {oldTime} to {newTime}");
            }

            if (order.RiderDepartureTime != effectiveRiderDepartureTime)
            {
                var oldTime = order.RiderDepartureTime.HasValue ? order.RiderDepartureTime.Value.ToString("MMM dd, yyyy h:mm tt") : "None";
                var newTime = effectiveRiderDepartureTime.HasValue ? effectiveRiderDepartureTime.Value.ToString("MMM dd, yyyy h:mm tt") : "None";
                auditChanges.Add($"Rider Departure Time changed from {oldTime} to {newTime}");
            }

            if (order.Fulfillment != request.Fulfillment)
                auditChanges.Add($"Fulfillment changed from '{order.Fulfillment}' to '{request.Fulfillment}'");

            if (order.DeliveryAddress != request.DeliveryAddress)
                auditChanges.Add($"Address changed from '{order.DeliveryAddress}' to '{request.DeliveryAddress}'");

            if (order.DeliveryFee != request.DeliveryFee)
                auditChanges.Add($"Delivery Fee changed from ₱{order.DeliveryFee} to ₱{request.DeliveryFee}");

            if (order.Price != request.Price)
                auditChanges.Add($"Lechon Subtotal changed from ₱{order.Price} to ₱{request.Price}");

            bool requiresRescheduling = false;
            if (!order.IsDraft && !isFinalizing)
            {
                if (order.TargetDeliveryTime != request.TargetDeliveryTime || order.RiderDepartureTime != effectiveRiderDepartureTime)
                {
                    requiresRescheduling = true;
                }
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
            order.DownpaymentMethod = request.Downpayment > 0
                ? PaymentChannels.Normalize(request.DownpaymentMethod, "GCash")
                : "None";
            order.FreebiesSummary = request.FreebiesSummary;
            order.FreebiesConfigJson = request.FreebiesConfigJson;
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
                        if (!order.IsDraft) requiresRescheduling = true;

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
                    if (!order.IsDraft) requiresRescheduling = true;

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
                if (!order.IsDraft) requiresRescheduling = true;

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

            if (request.Downpayment > previousDownpayment)
            {
                var additionalAmount = request.Downpayment - previousDownpayment;
                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = $"ORDER_EDIT_DP_{order.Id}_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}",
                    Provider = PaymentChannels.ToProvider(order.DownpaymentMethod),
                    PaymentMethod = order.DownpaymentMethod,
                    Amount = additionalAmount,
                    Status = PaymentStatus.Success
                });
            }

            // Handle finalization or rescheduling
            if (isFinalizing && order.TargetDeliveryTime.HasValue)
            {
                var itemCatIds = order.OrderItems.Select(i => i.ItemCategoryId).Distinct().ToList();
                var itemCategories = await _context.ItemCategories
                    .Where(c => itemCatIds.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, c => c);

                foreach (var item in order.OrderItems)
                {
                    if (itemCategories.TryGetValue(item.ItemCategoryId, out var cat) && cat.MinimumWeightKg <= 0)
                    {
                        continue; // Exclude add-ons
                    }

                    var newSchedule = await _schedulingService.CalculateScheduleAsync(
                        item.Id,
                        order.TargetDeliveryTime.Value,
                        item.ItemCategoryId,
                        order.RiderDepartureTime);

                    _context.OrderItemSchedules.Add(newSchedule);

                    await _inventoryService.CreatePendingReservationAsync(
                        order.Id,
                        item.ItemCategoryId,
                        order.TargetDeliveryTime.Value,
                        order.IsTrustedCustomer,
                        order.Downpayment
                    );
                }
            }
            else if (!order.IsDraft && requiresRescheduling && order.TargetDeliveryTime.HasValue)
            {
                var itemCatIds = order.OrderItems.Select(i => i.ItemCategoryId).Distinct().ToList();
                var itemCategories = await _context.ItemCategories
                    .Where(c => itemCatIds.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, c => c);

                foreach (var item in order.OrderItems)
                {
                    var oldSchedule = await _context.OrderItemSchedules
                        .FirstOrDefaultAsync(s => s.OrderItemId == item.Id);

                    if (itemCategories.TryGetValue(item.ItemCategoryId, out var cat) && cat.MinimumWeightKg <= 0)
                    {
                        if (oldSchedule != null) _context.OrderItemSchedules.Remove(oldSchedule);
                        continue;
                    }

                    if (oldSchedule != null && oldSchedule.IsManualOverride)
                    {
                        oldSchedule.TargetDeliveryTime = order.TargetDeliveryTime.Value;
                        continue;
                    }

                    if (oldSchedule != null) _context.OrderItemSchedules.Remove(oldSchedule);

                    var newSchedule = await _schedulingService.CalculateScheduleAsync(
                        item.Id,
                        order.TargetDeliveryTime.Value,
                        item.ItemCategoryId,
                        order.RiderDepartureTime);

                    _context.OrderItemSchedules.Add(newSchedule);
                }
            }

            // Save the highly-detailed Black Box record!
            if (auditChanges.Any())
            {
                string actionType = isFinalizing ? "Draft Finalized" : (order.IsDraft ? "Draft Edited" : "Order Edited");
                var auditLog = new OrderAuditLog
                {
                    OrderId = order.Id,
                    ActionType = actionType,
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
                IsDraft = order.IsDraft,
                CustomerName = order.CustomerName,
                FacebookName = order.FacebookName,
                ContactNumber = order.ContactNumber ?? string.Empty,
                Source = order.Source ?? string.Empty,
                EventType = order.EventType,
                DeliveryAddress = order.DeliveryAddress,
                Landmark = order.Landmark,
                Remarks = order.Remarks,
                Price = order.Price,
                AddOns = order.AddOns,
                DeliveryFee = order.DeliveryFee,
                Downpayment = order.Downpayment,
                DownpaymentMethod = order.DownpaymentMethod,
                FreebiesSummary = order.FreebiesSummary,
                FreebiesConfigJson = order.FreebiesConfigJson,
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
                IsOwnerConfirmed = order.IsOwnerConfirmed,
                OwnerConfirmedAt = order.OwnerConfirmedAt,
                OwnerConfirmedBy = order.OwnerConfirmedBy,
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

            dto.PaymentLogs = await _context.PaymentLogs
                .AsNoTracking()
                .Where(p => p.OrderId == orderId && p.Status == PaymentStatus.Success)
                .OrderBy(p => p.CreatedAt)
                .Select(p => new PaymentLogDto
                {
                    Id = p.Id,
                    Amount = p.Amount,
                    PaymentMethod = p.PaymentMethod,
                    Status = p.Status.ToString(),
                    GatewayReferenceId = p.GatewayReferenceId,
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            foreach (var payment in dto.PaymentLogs)
            {
                payment.PaymentMethod = PaymentChannels.Normalize(payment.PaymentMethod);
            }

            dto.PaymentChannelsSummary = dto.PaymentLogs
                .GroupBy(p => p.PaymentMethod)
                .Select(g => new PaymentChannelTotalDto
                {
                    PaymentMethod = g.Key,
                    Amount = g.Sum(p => p.Amount)
                })
                .OrderBy(p => Array.IndexOf(PaymentChannels.Supported, p.PaymentMethod))
                .ToList();

            if (dto.PaymentChannelsSummary.Count == 0 && order.Downpayment > 0)
            {
                dto.PaymentChannelsSummary.Add(new PaymentChannelTotalDto
                {
                    PaymentMethod = PaymentChannels.Normalize(order.DownpaymentMethod, "GCash"),
                    Amount = order.Downpayment
                });
            }

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
