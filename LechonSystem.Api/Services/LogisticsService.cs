using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public class LogisticsService : ILogisticsService
    {
        private readonly LechonDbContext _context;

        public LogisticsService(LechonDbContext context)
        {
            _context = context;
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

            // 💡 NEW SAFETY CHECK: Yell an error if any of the requested order IDs don't exist!
            if (ordersToAssign.Count != orderIds.Count)
            {
                throw new ArgumentException("One or more provided Order IDs were not found in the system database.");
            }

            // SPRINT FOCUS SPREAD: Defensive check for production completeness
            foreach (var order in ordersToAssign)
            {
                // Validation: Prevent pickup orders from getting assigned to delivery trips
                if (order.Fulfillment == FulfillmentType.Pickup)
                {
                    throw new InvalidOperationException($"Order #{order.Id} is a Pickup order and cannot be assigned to a delivery trip.");
                }

                // Validation: Check if the items are completely ready from the roasting machine
                // (Assuming your OrderItem or Order item tracks ProductionStatus from your previous milestone)
                // Inside your AssignRiderAsync method loops:
                // Inside LogisticsService.cs -> AssignRiderAsync
                foreach (var item in order.OrderItems)
                {
                    // Check CurrentStatus instead of ProductionStatus
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

            // Associate orders and update statuses
            foreach (var order in ordersToAssign)
            {
                order.RoutingStatus = DeliveryStatus.Assigned;
                newTrip.Orders.Add(order);
            }

            _context.DeliveryTrips.Add(newTrip);
            await _context.SaveChangesAsync();

            return newTrip;
        }
    }
}