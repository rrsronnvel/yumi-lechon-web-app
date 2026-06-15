using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.Interfaces;

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
                    .ThenInclude(i => i.OrderItemSchedule) // 👈 Tell EF Core to load the schedule records too!
                .Where(o => o.Fulfillment == FulfillmentType.Delivery
                         && o.RoutingStatus == DeliveryStatus.Unassigned)
                .OrderBy(o => o.TargetDeliveryTime)
                .ToListAsync();
        }

        // 2. The Batch Assignment with Security Validation Checks
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
                if (order.Fulfillment == FulfillmentType.Pickup)
                {
                    throw new InvalidOperationException($"Order #{order.Id} is a Pickup order and cannot be assigned to a delivery trip.");
                }

                foreach (var item in order.OrderItems)
                {
                    if (item.OrderItemSchedule == null || item.OrderItemSchedule.CurrentStatus != ProductionStatus.ReadyForDelivery)
                    {
                        throw new InvalidOperationException(
                            $"Dispatch Blocked: Order #{order.Id} cannot be assigned. An item is not 'ReadyForDelivery' yet.");
                    }
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

                // 1. TRIGGER THE TEXT DISPATCH IMMEDIATELY (Using ContactNumber!)
                string message = $"Good news! Your hot Lechon from Order #{order.Id} is now OUT FOR DELIVERY with our rider, {riderName}. Get the table ready! 🛵💨";

                bool dispatchSuccess = await _notificationSender.SendMessageAsync(order.ContactNumber, message);

                // 2. RECORD THE PERMANENT AUDIT TRAIL RECORD
                var log = new NotificationLog
                {
                    OrderId = order.Id,
                    RecipientPhone = order.ContactNumber,
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
    }
}