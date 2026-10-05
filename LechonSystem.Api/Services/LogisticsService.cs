using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.Interfaces;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services
{
    public class LogisticsService : ILogisticsService
    {
        private readonly LechonDbContext _context;
        private readonly INotificationSender _notificationSender;

        public LogisticsService(LechonDbContext context, INotificationSender notificationSender)
        {
            _context = context;
            _notificationSender = notificationSender;
        }

        // 1. Fetching unassigned orders (Optimized/Grouped can be handled on the frontend using this payload)
        public async Task<IEnumerable<Order>> GetUnassignedDeliveryOrdersAsync()
        {
            return await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.OrderItemSchedule)
                .Where(o => o.Fulfillment == FulfillmentType.Delivery
                         && o.RoutingStatus == DeliveryStatus.Unassigned
                         && o.TargetDeliveryTime.Date == DateTime.Today.AddDays(1).Date)
                .OrderBy(o => o.TargetDeliveryTime)
                .ToListAsync();
        }

        // 2. The Batch Assignment with Security Validation Checks and Automated Dispatch Notifications
        public async Task<DeliveryTrip> AssignRiderAsync(string riderName, string vehicleType, List<int> orderIds)
        {
            if (orderIds == null || !orderIds.Any())
            {
                throw new ArgumentException("You must provide at least one order ID to assign a rider.");
            }

            // Pull matching orders from the database
            var ordersToAssign = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.OrderItemSchedule)
                .Where(o => orderIds.Contains(o.Id))
                .ToListAsync();

            // Safety check: Yell an error if any of the requested order IDs don't exist
            if (ordersToAssign.Count != orderIds.Count)
            {
                throw new ArgumentException("One or more provided Order IDs were not found in the system database.");
            }

            // Defensive validation check for production completeness
            foreach (var order in ordersToAssign)
            {
                if (order.Fulfillment != FulfillmentType.Delivery)
                {
                    throw new InvalidOperationException($"Order #{order.Id} is a {order.Fulfillment} order and cannot be assigned to a delivery trip.");
                }
            }

            // If all checks pass, create the clipboard trip record
            var newTrip = new DeliveryTrip
            {
                RiderName = riderName,
                VehicleType = vehicleType,
                Status = DeliveryStatus.Assigned,
                DispatchTime = DateTime.UtcNow
            };

            // PROCESS THE BATCH: Update orders, send texts, and write audit logs in a single pass!
            foreach (var order in ordersToAssign)
            {
                order.RoutingStatus = DeliveryStatus.Assigned;
                newTrip.Orders.Add(order);

                // 1. MUTE THE TEXT MESSAGE (Just create a silent internal log for now)
                string message = $"Internal Log: Rider {riderName} assigned for tomorrow's delivery route.";

                // We pass 'false' or bypass the actual SMS sender so we don't text the customer the night before!
                bool dispatchSuccess = true;

                // 2. RECORD THE PERMANENT AUDIT TRAIL RECORD
                var log = new NotificationLog
                {
                    OrderId = order.Id,
                    RecipientPhone = order.ContactNumber, // Kept for record-keeping
                    MessageBody = message,
                    SentAt = DateTime.UtcNow,
                    IsSuccess = dispatchSuccess
                };

                _context.NotificationLogs.Add(log);
            }

            // Commit everything to the physical database inside a single atomic save operation
            _context.DeliveryTrips.Add(newTrip);
            await _context.SaveChangesAsync();

            return newTrip;
        }

        public async Task<IEnumerable<object>> GetTodayDispatchesAsync()
        {
            return await _context.Orders
                .Include(o => o.DeliveryTrip)
                .Where(o => o.Fulfillment == FulfillmentType.Delivery
                         && o.TargetDeliveryTime.Date == DateTime.Today.Date)
                .OrderBy(o => o.TargetDeliveryTime)
                .Select(o => new
                {
                    id = o.Id,
                    customerName = o.CustomerName,
                    deliveryAddress = o.DeliveryAddress,
                    targetDeliveryTime = o.TargetDeliveryTime,
                    riderName = o.DeliveryTrip != null ? o.DeliveryTrip.RiderName : null,
                    vehicleType = o.DeliveryTrip != null ? o.DeliveryTrip.VehicleType : null,
                    isDeliveryDetailsConfirmed = o.IsDeliveryDetailsConfirmed,
                    routingStatus = o.RoutingStatus.ToString()
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<object>> GetPendingSettlementDropsAsync()
        {
            return await _context.Orders
                .Include(o => o.DeliveryTrip)
                .Where(o => o.DeliveryTripId != null
                         && o.Fulfillment == FulfillmentType.Delivery
                         && !o.IsCancelled
                         && ((o.GrandTotal - o.Downpayment) - o.DeliveryFee) > 0) // 👈 True Settlement Filter
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new
                {
                    id = o.Id,
                    orderId = o.Id,
                    riderName = o.DeliveryTrip != null ? o.DeliveryTrip.RiderName : "Unassigned",
                    customerName = o.CustomerName,
                    isTrustedCustomer = o.IsTrustedCustomer,
                    deliveryAddress = o.DeliveryAddress,
                    totalCollected = o.GrandTotal - o.Downpayment,
                    riderDeliveryFee = o.DeliveryFee,
                    netRemittance = (o.GrandTotal - o.Downpayment) - o.DeliveryFee
                })
                .ToListAsync();
        }

        // --- Tri-Tab Manifest Settlement Methods ---

        // Tab 2: Walk-in Store Pickup Handovers (Counter Settlement)
        // "The Notebook Rule": Do not filter by date. All orders with an unsettled balance remain visible regardless of how many days ago they were created.
        public async Task<IEnumerable<PendingPickupSettlementDto>> GetPendingPickupSettlementsAsync()
        {
            return await _context.Orders
                .AsNoTracking()
                .Where(o => o.Fulfillment == FulfillmentType.Pickup
                         && !o.IsCancelled
                         && ((o.GrandTotal > 0 ? o.GrandTotal : (o.Price + o.DeliveryFee - o.Discount)) - o.Downpayment) > 0)
                .OrderByDescending(o => o.TargetDeliveryTime)
                .Select(o => new PendingPickupSettlementDto
                {
                    OrderId = o.Id,
                    CustomerName = o.CustomerName,
                    ContactNumber = o.ContactNumber ?? string.Empty,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    GrandTotal = o.GrandTotal > 0 ? o.GrandTotal : (o.Price + o.DeliveryFee - o.Discount),
                    Downpayment = o.Downpayment,
                    IsTrustedCustomer = o.IsTrustedCustomer,
                    Address = o.DeliveryAddress,
                    Remarks = o.Remarks
                })
                .ToListAsync();
        }

        // Tab 3: Lalamove Pre-Release Gate (Anti-Loss Courier Verification)
        public async Task<IEnumerable<PendingLalamoveSettlementDto>> GetPendingLalamoveSettlementsAsync()
        {
            var cutoffDate = DateTime.Today.AddDays(-1);
            return await _context.Orders
                .AsNoTracking()
                .Where(o => o.Fulfillment == FulfillmentType.Lalamove
                         && !o.IsCancelled
                         && o.TargetDeliveryTime >= cutoffDate
                         && o.RoutingStatus != DeliveryStatus.Delivered)
                .OrderBy(o => o.TargetDeliveryTime)
                .Select(o => new PendingLalamoveSettlementDto
                {
                    OrderId = o.Id,
                    CustomerName = o.CustomerName,
                    ContactNumber = o.ContactNumber ?? string.Empty,
                    DeliveryAddress = o.DeliveryAddress ?? string.Empty,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    GrandTotal = o.GrandTotal > 0 ? o.GrandTotal : (o.Price + o.DeliveryFee - o.Discount),
                    Downpayment = o.Downpayment,
                    IsReleased = o.RoutingStatus == DeliveryStatus.Delivered,
                    Remarks = o.Remarks
                })
                .ToListAsync();
        }

        public async Task<bool> ConfirmLalamoveReleaseAsync(int orderId)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
            {
                throw new ArgumentException($"Order #{orderId} was not found.");
            }

            if (order.Fulfillment != FulfillmentType.Lalamove)
            {
                throw new InvalidOperationException($"Order #{orderId} is not a Lalamove order.");
            }

            var balance = (order.GrandTotal > 0 ? order.GrandTotal : (order.Price + order.DeliveryFee - order.Discount)) - order.Downpayment;
            if (balance > 0)
            {
                throw new InvalidOperationException($"Cannot release Order #{orderId}: Unpaid balance of ₱{balance:N2}. Lalamove courier orders must be paid in full prior to physical release.");
            }

            order.RoutingStatus = DeliveryStatus.Delivered;
            order.UpdatedAt = DateTime.UtcNow;

            var auditLog = new OrderAuditLog
            {
                OrderId = orderId,
                ActionType = "Lalamove Release Confirmed",
                Changes = "Handover confirmed to third-party courier. Order marked Delivered / Dispatched.",
                ChangedBy = "Dispatcher",
                Timestamp = DateTime.UtcNow
            };
            _context.OrderAuditLogs.Add(auditLog);

            await _context.SaveChangesAsync();
            return true;
        }
    }
}