using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.Interfaces;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Common;

namespace LechonSystem.Api.Services
{
    public class LogisticsService : ILogisticsService
    {
        private readonly LechonDbContext _context;
        private readonly INotificationSender _notificationSender;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public LogisticsService(
            LechonDbContext context,
            INotificationSender notificationSender,
            IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _notificationSender = notificationSender;
            _httpContextAccessor = httpContextAccessor;
        }

        private string CurrentUser => UserIdentityHelper.ResolveDisplayName(_httpContextAccessor?.HttpContext?.User, "Owner");

        private static bool IsOwnerDigitalPayment(string? paymentMethod)
        {
            var normalized = (paymentMethod ?? string.Empty)
                .Replace(" ", string.Empty, StringComparison.Ordinal)
                .ToLowerInvariant();
            return normalized is "banktransfer" or "directgcash" or "gcash" or "manualgcash" or "maya";
        }

        // 1. Fetching unassigned orders (Returns all tomorrow orders so UI can flag non-delivery with badges)
        public async Task<IEnumerable<Order>> GetUnassignedDeliveryOrdersAsync()
        {
            return await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.OrderItemSchedule)
                .Where(o => !o.IsDraft && o.RoutingStatus == DeliveryStatus.Unassigned
                         && !o.IsDraft && !o.IsCancelled
                         && o.TargetDeliveryTime != null && o.TargetDeliveryTime.Value.Date == PhilippineTime.Tomorrow)
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

            var ordersToAssign = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.OrderItemSchedule)
                .Include(o => o.DeliveryTrip)
                .Where(o => orderIds.Contains(o.Id))
                .ToListAsync();

            if (ordersToAssign.Count != orderIds.Count)
            {
                throw new ArgumentException("One or more provided Order IDs were not found in the system database.");
            }

            foreach (var order in ordersToAssign)
            {
                if (order.Fulfillment != FulfillmentType.Delivery)
                {
                    throw new InvalidOperationException("Only Delivery orders can be assigned to freelance riders.");
                }
            }

            var cleanRiderName = string.IsNullOrWhiteSpace(riderName) ? "" : riderName.Trim();
            await RiderRegistrationHelper.EnsureRiderRegisteredAsync(_context, cleanRiderName);

            var newTrip = new DeliveryTrip
            {
                RiderName = cleanRiderName,
                VehicleType = vehicleType,
                Status = DeliveryStatus.Assigned,
                DispatchTime = DateTime.UtcNow
            };

            foreach (var order in ordersToAssign)
            {
                var oldRider = order.DeliveryTrip?.RiderName?.Trim() ?? "";
                order.RoutingStatus = DeliveryStatus.Assigned;
                newTrip.Orders.Add(order);

                string message = $"Internal Log: Rider {cleanRiderName} assigned for tomorrow's delivery route.";
                bool dispatchSuccess = true;

                var log = new NotificationLog
                {
                    OrderId = order.Id,
                    RecipientPhone = order.ContactNumber,
                    MessageBody = message,
                    SentAt = DateTime.UtcNow,
                    IsSuccess = dispatchSuccess
                };

                _context.NotificationLogs.Add(log);

                // Rider Assignment Audit Log
                if (!string.Equals(oldRider, cleanRiderName, StringComparison.OrdinalIgnoreCase))
                {
                    string auditMsg = string.IsNullOrEmpty(oldRider)
                        ? $"Rider assigned: '{cleanRiderName}'"
                        : (string.IsNullOrEmpty(cleanRiderName)
                            ? $"Rider unassigned (previously '{oldRider}')"
                            : $"Rider changed from '{oldRider}' to '{cleanRiderName}'");

                    _context.OrderAuditLogs.Add(new OrderAuditLog
                    {
                        OrderId = order.Id,
                        ActionType = "Rider Updated",
                        Changes = auditMsg,
                        ChangedBy = CurrentUser,
                        Timestamp = DateTime.UtcNow
                    });
                }
            }

            _context.DeliveryTrips.Add(newTrip);
            await _context.SaveChangesAsync();

            return newTrip;
        }

        public Task<DeliveryTrip> AssignRiderToOrdersAsync(string riderName, string vehicleType, List<int> orderIds)
            => AssignRiderAsync(riderName, vehicleType, orderIds);

        public async Task<bool> UnassignRiderAsync(int orderId)
        {
            var order = await _context.Orders
                .Include(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
            {
                throw new ArgumentException($"Order #{orderId} not found.");
            }

            var oldRider = order.DeliveryTrip?.RiderName?.Trim() ?? "";
            var oldTripId = order.DeliveryTripId;
            order.DeliveryTripId = null;
            order.RoutingStatus = DeliveryStatus.Unassigned;

            if (oldTripId.HasValue)
            {
                var hasOtherOrders = await _context.Orders.AnyAsync(o => o.DeliveryTripId == oldTripId.Value && o.Id != orderId);
                if (!hasOtherOrders)
                {
                    var trip = await _context.DeliveryTrips.FindAsync(oldTripId.Value);
                    if (trip != null)
                    {
                        _context.DeliveryTrips.Remove(trip);
                    }
                }
            }

            if (!string.IsNullOrEmpty(oldRider))
            {
                _context.OrderAuditLogs.Add(new OrderAuditLog
                {
                    OrderId = order.Id,
                    ActionType = "Rider Updated",
                    Changes = $"Rider unassigned (previously '{oldRider}')",
                    ChangedBy = CurrentUser,
                    Timestamp = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<object>> GetTodayDispatchesAsync()
        {
            var today = PhilippineTime.Today;

            return await _context.Orders
                .Include(o => o.DeliveryTrip)
                .Where(o => o.Fulfillment == FulfillmentType.Delivery
                         && !o.IsCancelled
                         && !o.IsDraft
                         && o.TargetDeliveryTime.HasValue
                         && o.TargetDeliveryTime.Value.Date == today)
                .OrderBy(o => o.RiderDepartureTime ?? o.TargetDeliveryTime)
                .Select(o => new
                {
                    id = o.Id,
                    customerName = o.CustomerName,
                    facebookName = o.FacebookName,
                    source = o.Source,
                    deliveryAddress = o.DeliveryAddress,
                    targetDeliveryTime = o.TargetDeliveryTime,
                    riderDepartureTime = o.RiderDepartureTime,
                    riderName = o.DeliveryTrip != null ? o.DeliveryTrip.RiderName : null,
                    vehicleType = o.DeliveryTrip != null ? o.DeliveryTrip.VehicleType : null,
                    isDeliveryDetailsConfirmed = o.IsDeliveryDetailsConfirmed,
                    routingStatus = o.RoutingStatus.ToString(),
                    fulfillment = (int)o.Fulfillment
                })
                .ToListAsync();
        }

        // Tab 1: Freelance Rider Settlements (Remains visible while SettlementCustodyStatus != "Settled")
        public async Task<IEnumerable<PendingSettlementDropDto>> GetPendingSettlementDropsAsync()
        {
            var today = PhilippineTime.Today;
            return await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryTrip)
                .Where(o => o.Fulfillment == FulfillmentType.Delivery
                         && !o.IsDraft && !o.IsCancelled
                         && o.SettlementCustodyStatus != "Settled"
                         && o.TargetDeliveryTime.HasValue && o.TargetDeliveryTime.Value.Date <= today
                         && (((o.GrandTotal > 0
                                  ? o.GrandTotal
                                  : (o.Price + o.DeliveryFee - o.Discount)) - o.Downpayment) > 0
                             || o.SettlementCustodyStatus == "InStaffDrawer"
                             || o.SettlementCustodyStatus == "AwaitingOwnerDigitalVerification"
                             || (o.DigitalTransferAmount ?? 0m) > 0m))
                .OrderBy(o => o.TargetDeliveryTime)
                .ThenBy(o => o.Id)
                .Select(o => new PendingSettlementDropDto
                {
                    Id = o.Id,
                    OrderId = o.Id,
                    OrderReference = o.OrderReference,
                    RiderName = o.DeliveryTrip != null
                        && !string.IsNullOrWhiteSpace(o.DeliveryTrip.RiderName)
                        && o.DeliveryTrip.RiderName != "Unassigned"
                            ? o.DeliveryTrip.RiderName
                            : (o.RiderSignedBy ?? "Unassigned"),
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    Source = o.Source,
                    IsTrustedCustomer = o.IsTrustedCustomer,
                    DeliveryAddress = o.DeliveryAddress ?? string.Empty,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    RiderDepartureTime = o.RiderDepartureTime,
                    TotalCollected = (o.GrandTotal > 0
                        ? o.GrandTotal
                        : (o.Price + o.DeliveryFee - o.Discount)) - o.Downpayment,
                    RiderDeliveryFee = o.DeliveryFee,
                    NetRemittance = (o.DigitalTransferAmount ?? 0m) > 0m
                        ? Math.Max(0m, (o.HeldByStaffAmount ?? 0m) + (o.DigitalTransferAmount ?? 0m))
                        : o.HeldByStaffAmount ?? o.RiderRemittedAmount ?? Math.Max(0,
                            ((o.GrandTotal > 0
                                ? o.GrandTotal
                                : (o.Price + o.DeliveryFee - o.Discount)) - o.Downpayment) - o.DeliveryFee),
                    CustodyStatus = string.IsNullOrEmpty(o.SettlementCustodyStatus) ? "Uncollected" : o.SettlementCustodyStatus,
                    RiderSignedBy = o.RiderSignedBy,
                    HeldByStaffName = o.StaffValidatedBy,
                    HeldPaymentMethod = o.HeldByStaffMethod,
                    HeldByStaffAmount = o.HeldByStaffAmount,
                    DigitalTransferMethod = o.DigitalTransferMethod,
                    DigitalTransferAmount = o.DigitalTransferAmount,
                    DigitalReferenceNote = o.DigitalReferenceNote
                })
                .ToListAsync();
        }

        // Tab 2: Walk-in Store Pickup Handovers (Counter Settlement)
        // Remains visible while SettlementCustodyStatus != "Settled" and balance > 0
        public async Task<IEnumerable<PendingPickupSettlementDto>> GetPendingPickupSettlementsAsync()
        {
            var today = PhilippineTime.Today;
            return await _context.Orders
                .AsNoTracking()
                .Where(o => o.Fulfillment == FulfillmentType.Pickup
                         && !o.IsDraft && !o.IsCancelled
                         && o.SettlementCustodyStatus != "Settled"
                         && o.TargetDeliveryTime.HasValue && o.TargetDeliveryTime.Value.Date <= today
                         && (((o.GrandTotal > 0 ? o.GrandTotal : (o.Price + o.DeliveryFee - o.Discount)) - o.Downpayment) > 0
                             || o.SettlementCustodyStatus == "InStaffDrawer"
                             || o.SettlementCustodyStatus == "AwaitingOwnerDigitalVerification"
                             || (o.DigitalTransferAmount ?? 0m) > 0m))
                .OrderBy(o => o.TargetDeliveryTime)
                .ThenBy(o => o.Id)
                .Select(o => new PendingPickupSettlementDto
                {
                    OrderId = o.Id,
                    OrderReference = o.OrderReference,
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    Source = o.Source,
                    ContactNumber = o.ContactNumber ?? string.Empty,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    RiderDepartureTime = o.RiderDepartureTime,
                    GrandTotal = o.GrandTotal > 0 ? o.GrandTotal : (o.Price + o.DeliveryFee - o.Discount),
                    Downpayment = o.Downpayment,
                    IsTrustedCustomer = o.IsTrustedCustomer,
                    Address = o.DeliveryAddress,
                    Landmark = o.Landmark,
                    Remarks = o.Remarks,
                    CustodyStatus = string.IsNullOrEmpty(o.SettlementCustodyStatus) ? "Uncollected" : o.SettlementCustodyStatus,
                    RiderSignedBy = o.RiderSignedBy,
                    HeldByStaffName = o.StaffValidatedBy,
                    HeldPaymentMethod = o.HeldByStaffMethod,
                    HeldByStaffAmount = o.HeldByStaffAmount,
                    DigitalTransferMethod = o.DigitalTransferMethod,
                    DigitalTransferAmount = o.DigitalTransferAmount,
                    DigitalReferenceNote = o.DigitalReferenceNote
                })
                .ToListAsync();
        }

        // Tab 3: Lalamove Pre-Release Gate (Anti-Loss Courier Verification)
        public async Task<IEnumerable<PendingLalamoveSettlementDto>> GetPendingLalamoveSettlementsAsync()
        {
            var today = PhilippineTime.Today;
            return await _context.Orders
                .AsNoTracking()
                .Where(o => o.Fulfillment == FulfillmentType.Lalamove
                         && !o.IsDraft && !o.IsCancelled
                         && o.TargetDeliveryTime.HasValue && o.TargetDeliveryTime.Value.Date <= today
                         && o.RoutingStatus != DeliveryStatus.Delivered)
                .OrderBy(o => o.TargetDeliveryTime)
                .ThenBy(o => o.Id)
                .Select(o => new PendingLalamoveSettlementDto
                {
                    OrderId = o.Id,
                    OrderReference = o.OrderReference,
                    CustomerName = o.CustomerName,
                    FacebookName = o.FacebookName,
                    Source = o.Source,
                    IsTrustedCustomer = o.IsTrustedCustomer,
                    ContactNumber = o.ContactNumber ?? string.Empty,
                    DeliveryAddress = o.DeliveryAddress ?? string.Empty,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    RiderDepartureTime = o.RiderDepartureTime,
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

        public async Task<IEnumerable<DownpaymentTrackerItemDto>> GetDownpaymentsAsync()
        {
            var items = await _context.Orders
                .AsNoTracking()
                .Where(o => !o.IsDraft
                         && !o.IsCancelled
                         && (o.Downpayment > 0m || o.Source == "Walk-in"))
                .OrderByDescending(o => o.CreatedAt)
                .ThenByDescending(o => o.Id)
                .Select(o => new DownpaymentTrackerItemDto
                {
                    OrderId = o.Id,
                    OrderReference = o.OrderReference,
                    CustomerName = o.CustomerName,
                    PhoneNumber = o.ContactNumber ?? string.Empty,
                    BookingSource = o.Source ?? string.Empty,
                    DownpaymentAmount = o.Downpayment,
                    DownpaymentMethod = o.DownpaymentMethod,
                    TargetDeliveryTime = o.TargetDeliveryTime,
                    CreatedAt = o.CreatedAt,
                    EncodedBy = o.CreatedBy,
                    IsDpRemittedToOwner = o.IsDpRemittedToOwner,
                    DpRemittedAt = o.DpRemittedAt,
                    DpRemittedBy = o.DpRemittedBy
                })
                .ToListAsync();

            if (items.Count == 0)
            {
                return items;
            }

            var orderIds = items.Select(item => item.OrderId).ToList();
            var paymentMethods = await _context.PaymentLogs
                .AsNoTracking()
                .Where(payment => orderIds.Contains(payment.OrderId)
                                  && payment.Status == PaymentStatus.Success
                                  && !payment.IsVoided)
                .OrderBy(payment => payment.CreatedAt)
                .ThenBy(payment => payment.Id)
                .Select(payment => new { payment.OrderId, payment.PaymentMethod })
                .ToListAsync();
            var firstPaymentMethodByOrder = paymentMethods
                .GroupBy(payment => payment.OrderId)
                .ToDictionary(group => group.Key, group => group.First().PaymentMethod);

            foreach (var item in items)
            {
                firstPaymentMethodByOrder.TryGetValue(item.OrderId, out var firstPaymentMethod);
                item.DownpaymentMethod = ResolveDownpaymentMethod(item.DownpaymentMethod, firstPaymentMethod);
            }

            return items;
        }

        public async Task<DownpaymentTrackerItemDto> ToggleDownpaymentRemittanceAsync(int orderId, string currentUser)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null || order.IsDraft || order.IsCancelled)
            {
                throw new KeyNotFoundException($"Order #{orderId} was not found in the active downpayment tracker.");
            }
            if (order.Downpayment <= 0m && !string.Equals(order.Source, "Walk-in", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"Order #{orderId} does not have a downpayment and is not a Walk-in booking.");
            }

            order.IsDpRemittedToOwner = !order.IsDpRemittedToOwner;
            order.DpRemittedAt = order.IsDpRemittedToOwner ? PhilippineTime.Now : null;
            order.DpRemittedBy = order.IsDpRemittedToOwner ? currentUser : null;
            order.UpdatedAt = DateTime.UtcNow;

            var firstPaymentMethod = await _context.PaymentLogs
                .AsNoTracking()
                .Where(payment => payment.OrderId == order.Id
                                  && payment.Status == PaymentStatus.Success
                                  && !payment.IsVoided)
                .OrderBy(payment => payment.CreatedAt)
                .ThenBy(payment => payment.Id)
                .Select(payment => payment.PaymentMethod)
                .FirstOrDefaultAsync();
            var method = ResolveDownpaymentMethod(order.DownpaymentMethod, firstPaymentMethod);

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = order.IsDpRemittedToOwner ? "DP Verified" : "DP Verification Reverted",
                Changes = order.IsDpRemittedToOwner
                    ? $"[DP Verified] Downpayment of ₱{order.Downpayment:N2} ({method}) marked as remitted/verified by Owner."
                    : $"[DP Verification Reverted] Downpayment of ₱{order.Downpayment:N2} ({method}) returned to Unremitted by Owner.",
                ChangedBy = currentUser,
                Timestamp = PhilippineTime.Now
            });

            await _context.SaveChangesAsync();

            return new DownpaymentTrackerItemDto
            {
                OrderId = order.Id,
                OrderReference = order.OrderReference,
                CustomerName = order.CustomerName,
                PhoneNumber = order.ContactNumber ?? string.Empty,
                BookingSource = order.Source ?? string.Empty,
                DownpaymentAmount = order.Downpayment,
                DownpaymentMethod = method,
                TargetDeliveryTime = order.TargetDeliveryTime,
                CreatedAt = order.CreatedAt,
                EncodedBy = order.CreatedBy,
                IsDpRemittedToOwner = order.IsDpRemittedToOwner,
                DpRemittedAt = order.DpRemittedAt,
                DpRemittedBy = order.DpRemittedBy
            };
        }

        private static string ResolveDownpaymentMethod(string? orderMethod, string? firstPaymentMethod)
        {
            var rawMethod = !string.IsNullOrWhiteSpace(orderMethod)
                            && !string.Equals(orderMethod, "None", StringComparison.OrdinalIgnoreCase)
                ? orderMethod
                : firstPaymentMethod;
            return string.IsNullOrWhiteSpace(rawMethod)
                ? "None"
                : PaymentChannels.Normalize(rawMethod, rawMethod.Trim());
        }

        // ==========================================
        // TWO-HOP QR CUSTODY CHAIN METHODS
        // ==========================================

        // 1. Create QR Session (10-minute validity) or Resume Active
        public async Task<QrSessionStatusDto> CreateQrSessionAsync(CreateQrSessionRequest request)
        {
            var order = await _context.Orders
                .Include(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(o => o.Id == request.OrderId);

            if (order == null)
            {
                throw new ArgumentException($"Order #{request.OrderId} does not exist.");
            }

            if (string.Equals(request.HopStage, "StaffToOwner", StringComparison.OrdinalIgnoreCase) &&
                order.HeldByStaffAmount.HasValue)
            {
                var heldCash = Math.Max(0m, order.HeldByStaffAmount.Value);
                var digitalAmount = Math.Max(0m, order.DigitalTransferAmount ?? 0m);
                var isFullyDigital = heldCash <= 0m && digitalAmount > 0m;
                request.ExpectedAmount = isFullyDigital ? digitalAmount : heldCash;
                request.PaymentMethod = isFullyDigital
                    ? order.DigitalTransferMethod ?? order.HeldByStaffMethod ?? "DirectGCash"
                    : "Cash";
                request.ReferenceNumber = isFullyDigital
                    ? order.DigitalReferenceNote
                    : request.ReferenceNumber;
            }

            var existingSession = await _context.SettlementQrSessions
                .Include(s => s.Order)
                    .ThenInclude(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.OrderId == request.OrderId
                                       && s.HopStage == request.HopStage
                                       && !s.IsUsed
                                       && s.Status != "Expired"
                                       && s.ExpiresAt > DateTime.UtcNow);

            if (existingSession != null)
            {
                if (!string.IsNullOrWhiteSpace(request.PaymentMethod) && existingSession.PaymentMethod != request.PaymentMethod)
                {
                    existingSession.PaymentMethod = request.PaymentMethod;
                }
                if (request.ExpectedAmount > 0)
                {
                    existingSession.ExpectedAmount = request.ExpectedAmount;
                }
                if (!string.IsNullOrWhiteSpace(request.ReferenceNumber))
                {
                    existingSession.ReferenceNumber = request.ReferenceNumber.Trim();
                }
                await _context.SaveChangesAsync();
                return MapToStatusDto(existingSession, existingSession.Order ?? order);
            }

            // Invalidate any previously unconsumed sessions for this order to ensure fresh single-session flow
            var previousActiveSessions = await _context.SettlementQrSessions
                .Where(s => s.OrderId == request.OrderId && !s.IsUsed && s.ExpiresAt > DateTime.UtcNow)
                .ToListAsync();

            foreach (var prev in previousActiveSessions)
            {
                prev.IsUsed = true;
            }

            var session = new SettlementQrSession
            {
                Token = Guid.NewGuid().ToString("N"),
                OrderId = request.OrderId,
                HopStage = request.HopStage, // "RiderToStaff" or "StaffToOwner"
                PaymentMethod = request.PaymentMethod,
                ExpectedAmount = request.ExpectedAmount,
                ReferenceNumber = request.ReferenceNumber,
                Status = "PendingScan",
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(10),
                IsUsed = false,
                RiderSignedBy = order.RiderSignedBy,
                RiderRemittedAmount = order.RiderRemittedAmount,
                RiderSignedAt = order.RiderSignedAt,
                StaffValidatedBy = order.StaffValidatedBy,
                StaffValidatedAt = order.StaffValidatedAt
            };

            _context.SettlementQrSessions.Add(session);
            await _context.SaveChangesAsync();

            return MapToStatusDto(session, order);
        }

        // 2. Query QR Session Status by Token
        public async Task<QrSessionStatusDto?> GetQrSessionByTokenAsync(string token)
        {
            var session = await _context.SettlementQrSessions
                .Include(s => s.Order)
                    .ThenInclude(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.Token == token);

            if (session == null)
            {
                return null;
            }

            if (DateTime.UtcNow > session.ExpiresAt && session.Status == "PendingScan")
            {
                session.Status = "Expired";
                await _context.SaveChangesAsync();
            }

            return MapToStatusDto(session, session.Order);
        }

        // 3. Rider Digital Signature
        public async Task<QrSessionStatusDto> RiderSignQrSessionAsync(string token, RiderSignRequest request)
        {
            var session = await _context.SettlementQrSessions
                .Include(s => s.Order)
                    .ThenInclude(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.Token == token);

            if (session == null)
            {
                throw new ArgumentException("QR session not found or invalid.");
            }

            if (session.IsUsed)
            {
                throw new InvalidOperationException("This QR session has already been used and finalized.");
            }

            if (DateTime.UtcNow > session.ExpiresAt)
            {
                session.Status = "Expired";
                await _context.SaveChangesAsync();
                throw new InvalidOperationException("This QR session has expired (10-minute limit). Please ask counter staff to generate a new QR code.");
            }

            if (session.HopStage != "RiderToStaff")
            {
                throw new InvalidOperationException($"Invalid hop stage: {session.HopStage}. Rider signature is only valid for RiderToStaff stage.");
            }

            if (string.IsNullOrWhiteSpace(request.RiderName))
            {
                throw new ArgumentException("Rider name is required.");
            }

            if (request.RemittedAmount < 0)
            {
                throw new ArgumentException("Remitted amount cannot be negative.");
            }

            session.RiderSignedBy = request.RiderName.Trim();
            await RiderRegistrationHelper.EnsureRiderRegisteredAsync(_context, session.RiderSignedBy);
            session.RiderRemittedAmount = request.RemittedAmount;
            session.RiderSignedAt = DateTime.UtcNow;
            session.Status = "SignedByRider";

            await _context.SaveChangesAsync();
            return MapToStatusDto(session, session.Order);
        }

        // 3b. Safeguard 1 — Discrepancy Rejection
        public async Task<QrSessionStatusDto> RejectRiderSignatureAsync(string token)
        {
            var session = await _context.SettlementQrSessions
                .Include(s => s.Order)
                    .ThenInclude(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.Token == token);

            if (session == null)
            {
                throw new KeyNotFoundException("QR session not found or invalid.");
            }

            if (session.HopStage != "RiderToStaff" || session.IsUsed)
            {
                throw new InvalidOperationException($"Cannot reject signature: session HopStage is '{session.HopStage}' and IsUsed is '{session.IsUsed}'.");
            }

            session.Status = "PendingScan";
            session.RiderSignedBy = null;
            session.RiderRemittedAmount = null;
            session.RiderSignedAt = null;

            await _context.SaveChangesAsync();

            var dto = MapToStatusDto(session, session.Order);
            dto.WasRejected = true;
            return dto;
        }

        // 4. Staff Validates Cash into Drawer
        public async Task<QrSessionStatusDto> StaffValidateQrSessionAsync(string token, StaffValidateRequest? request, string staffUsername)
        {
            var session = await _context.SettlementQrSessions
                .Include(s => s.Order)
                    .ThenInclude(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.Token == token);

            if (session == null)
            {
                throw new ArgumentException("QR session not found.");
            }

            if (session.IsUsed)
            {
                throw new InvalidOperationException("This QR session has already been processed.");
            }

            if (DateTime.UtcNow > session.ExpiresAt)
            {
                session.Status = "Expired";
                await _context.SaveChangesAsync();
                throw new InvalidOperationException("This QR session has expired.");
            }

            var requestedCash = Math.Max(0m, request?.CashAmount ?? 0m);
            var requestedDigital = Math.Max(0m, request?.DigitalAmount ?? 0m);
            var isSplit = requestedCash > 0m && requestedDigital > 0m;
            var isFullOwnerDigital = !isSplit && IsOwnerDigitalPayment(session.PaymentMethod);

            // Direct-to-owner digital channels do not require a physical rider QR handshake.
            if (isFullOwnerDigital)
            {
                session.RiderSignedBy = session.Order.DeliveryTrip?.RiderName
                    ?? request?.ManualOverrideRiderName?.Trim()
                    ?? session.RiderSignedBy
                    ?? "Unassigned";
                // The rider physically collected/remitted ₱0; the customer paid the Owner account.
                session.RiderRemittedAmount = 0m;
                session.RiderSignedAt = DateTime.UtcNow;
            }
            // If rider's phone is dead, manual counter override supplies details.
            else if (!string.IsNullOrWhiteSpace(request?.ManualOverrideRiderName))
            {
                session.RiderSignedBy = request.ManualOverrideRiderName.Trim();
                await RiderRegistrationHelper.EnsureRiderRegisteredAsync(_context, session.RiderSignedBy);
                session.RiderRemittedAmount = isSplit
                    ? session.ExpectedAmount
                    : request.ManualOverrideAmount ?? session.ExpectedAmount;
                session.RiderSignedAt = DateTime.UtcNow;
            }
            else if (session.Status != "SignedByRider")
            {
                throw new InvalidOperationException("Cannot validate: Rider has not yet submitted digital signature.");
            }

            session.StaffValidatedBy = staffUsername;
            session.StaffValidatedAt = DateTime.UtcNow;
            session.Status = "ValidatedByStaff";
            session.IsUsed = true;

            var order = session.Order;
            var cashAmount = isSplit
                ? requestedCash
                : isFullOwnerDigital
                    ? 0m
                    : (session.RiderRemittedAmount ?? session.ExpectedAmount);
            var digitalAmount = isSplit
                ? requestedDigital
                : isFullOwnerDigital
                    ? (requestedDigital > 0m ? requestedDigital : session.ExpectedAmount)
                    : 0m;
            if ((isSplit || isFullOwnerDigital) && cashAmount + digitalAmount != session.ExpectedAmount)
            {
                throw new ArgumentException($"Cash and digital amounts must equal the expected remittance of ₱{session.ExpectedAmount:N2}.");
            }

            order.SettlementCustodyStatus = isFullOwnerDigital
                ? "AwaitingOwnerDigitalVerification"
                : "InStaffDrawer";
            order.HeldByStaffMethod = isSplit ? "Cash" : session.PaymentMethod;
            order.HeldByStaffAmount = cashAmount;
            order.RiderSignedBy = session.RiderSignedBy;
            if (!string.IsNullOrWhiteSpace(order.RiderSignedBy))
            {
                await RiderRegistrationHelper.EnsureRiderRegisteredAsync(_context, order.RiderSignedBy);
            }
            order.RiderRemittedAmount = session.RiderRemittedAmount;
            order.RiderSignedAt = session.RiderSignedAt;
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;

            if (digitalAmount > 0m)
            {
                var digitalMethod = isFullOwnerDigital
                    ? session.PaymentMethod
                    : request?.DigitalMethod ?? "DirectGCash";
                var digitalReference = !string.IsNullOrWhiteSpace(request?.DigitalReferenceNumber)
                    ? request.DigitalReferenceNumber.Trim()
                    : string.Empty;
                if (string.IsNullOrWhiteSpace(digitalReference))
                {
                    throw new ArgumentException("Bank Name / Reference Note is required for a digital transfer.");
                }

                order.DigitalTransferMethod = digitalMethod;
                order.DigitalTransferAmount = digitalAmount;
                order.DigitalReferenceNote = digitalReference;
                session.ReferenceNumber = digitalReference;
            }
            else
            {
                order.DigitalTransferMethod = null;
                order.DigitalTransferAmount = null;
                order.DigitalReferenceNote = null;
            }

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = isFullOwnerDigital
                    ? "Digital Transfer: Awaiting Owner Verification"
                    : "Custody: In Staff Drawer",
                Changes = isFullOwnerDigital
                    ? $"Staff logged ₱{digitalAmount:N2} via {session.PaymentMethod} for Owner account verification. Ref: {order.DigitalReferenceNote}. Physical drawer received ₱0.00."
                    : isSplit
                        ? $"Split handover validated: ₱{cashAmount:N2} Cash placed in drawer + ₱{digitalAmount:N2} via {request?.DigitalMethod}. Digital ref: {order.DigitalReferenceNote}. Validated by {staffUsername}."
                        : $"Rider {session.RiderSignedBy} remitted ₱{session.RiderRemittedAmount:N2} via {session.PaymentMethod}. Validated into drawer by {staffUsername}.",
                ChangedBy = staffUsername,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return MapToStatusDto(session, order);
        }

        // 5. Store Counter Collection (Tab 2: Walk-in Store Pickups)
        public async Task<bool> CounterCollectPickupAsync(int orderId, string paymentMethod, string staffUsername, decimal? amount = null, string? referenceNumber = null, decimal? cashAmount = null, decimal? digitalAmount = null, string? digitalMethod = null, string? digitalReferenceNumber = null)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
            {
                throw new ArgumentException($"Order #{orderId} not found.");
            }

            var balance = (order.GrandTotal > 0 ? order.GrandTotal : (order.Price + order.DeliveryFee - order.Discount)) - order.Downpayment;
            var collectedAmount = amount ?? balance;
            var isSplit = (cashAmount ?? 0m) > 0m || (digitalAmount ?? 0m) > 0m;
            var isFullOwnerDigital = !isSplit && IsOwnerDigitalPayment(paymentMethod);
            var physicalCash = isSplit
                ? Math.Max(0m, cashAmount ?? 0m)
                : isFullOwnerDigital ? 0m : collectedAmount;
            var digitalTransfer = isSplit
                ? Math.Max(0m, digitalAmount ?? 0m)
                : isFullOwnerDigital ? collectedAmount : 0m;
            if (isSplit && (physicalCash <= 0m || digitalTransfer <= 0m))
            {
                throw new ArgumentException("Split handover requires positive Cash and Digital amounts.");
            }
            if (isSplit && physicalCash + digitalTransfer != collectedAmount)
            {
                throw new ArgumentException($"Split amounts must equal the collection amount of ₱{collectedAmount:N2}.");
            }

            order.SettlementCustodyStatus = isFullOwnerDigital
                ? "AwaitingOwnerDigitalVerification"
                : "InStaffDrawer";
            order.HeldByStaffMethod = isSplit ? "Cash" : paymentMethod;
            order.HeldByStaffAmount = physicalCash;
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;

            if (digitalTransfer > 0m)
            {
                var normalizedDigitalMethod = isFullOwnerDigital
                    ? paymentMethod
                    : digitalMethod ?? "DirectGCash";
                var digitalRef = !string.IsNullOrWhiteSpace(digitalReferenceNumber)
                    ? digitalReferenceNumber.Trim()
                    : referenceNumber?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(digitalRef))
                {
                    throw new ArgumentException("Bank Name / Reference Note is required for a digital transfer.");
                }

                order.DigitalTransferMethod = normalizedDigitalMethod;
                order.DigitalTransferAmount = digitalTransfer;
                order.DigitalReferenceNote = digitalRef;
            }
            else
            {
                order.DigitalTransferMethod = null;
                order.DigitalTransferAmount = null;
                order.DigitalReferenceNote = null;
            }

            // When collecting payment for a Lalamove order:
            // Courier orders must be paid in full prior to release. Update Downpayment so BalanceDue evaluates to ₱0
            // and GateStatus evaluates to ClearToRelease (🟢 CLEAR TO RELEASE).
            if (order.Fulfillment == FulfillmentType.Lalamove && !isSplit && !isFullOwnerDigital)
            {
                order.Downpayment += collectedAmount;

                var normalizedPaymentMethod = PaymentChannels.Normalize(paymentMethod);
                var provider = PaymentChannels.ToProvider(normalizedPaymentMethod);

                var refId = !string.IsNullOrWhiteSpace(referenceNumber)
                    ? referenceNumber
                    : $"LALAMOVE_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}";

                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = refId,
                    Provider = provider,
                    PaymentMethod = normalizedPaymentMethod,
                    Amount = collectedAmount,
                    Status = PaymentStatus.Success
                });
            }

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = order.Fulfillment == FulfillmentType.Lalamove ? "Lalamove Payment Collected" : "Counter Pickup Collected",
                Changes = isFullOwnerDigital
                    ? $"Store counter logged ₱{digitalTransfer:N2} via {paymentMethod} for Owner verification. Ref: {order.DigitalReferenceNote}. Physical drawer received ₱0.00."
                    : isSplit
                        ? $"Split counter handover: ₱{physicalCash:N2} Cash held in drawer + ₱{digitalTransfer:N2} via {digitalMethod}. Digital ref: {order.DigitalReferenceNote}. Collected by {staffUsername}."
                        : $"Store counter collected ₱{collectedAmount:N2} via {paymentMethod}. Held in drawer by {staffUsername}.",
                ChangedBy = staffUsername,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<QrSessionStatusDto> CounterCollectQrSessionAsync(string token, string staffUsername)
        {
            var session = await _context.SettlementQrSessions
                .Include(s => s.Order)
                    .ThenInclude(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.Token == token);

            if (session == null)
            {
                throw new ArgumentException("QR session not found.");
            }

            session.StaffValidatedBy = staffUsername;
            session.StaffValidatedAt = DateTime.UtcNow;
            session.Status = "ValidatedByStaff";
            session.IsUsed = true;

            var order = session.Order;
            var isFullOwnerDigital = IsOwnerDigitalPayment(session.PaymentMethod);
            order.SettlementCustodyStatus = isFullOwnerDigital
                ? "AwaitingOwnerDigitalVerification"
                : "InStaffDrawer";
            order.HeldByStaffMethod = session.PaymentMethod;
            order.HeldByStaffAmount = isFullOwnerDigital ? 0m : session.ExpectedAmount;
            order.DigitalTransferMethod = isFullOwnerDigital ? session.PaymentMethod : null;
            order.DigitalTransferAmount = isFullOwnerDigital ? session.ExpectedAmount : null;
            order.DigitalReferenceNote = isFullOwnerDigital ? session.ReferenceNumber : null;
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;

            if (order.Fulfillment == FulfillmentType.Lalamove)
            {
                order.Downpayment += session.ExpectedAmount;

                var normalizedPaymentMethod = PaymentChannels.Normalize(session.PaymentMethod);
                var provider = PaymentChannels.ToProvider(normalizedPaymentMethod);

                var refId = !string.IsNullOrWhiteSpace(session.ReferenceNumber)
                    ? session.ReferenceNumber
                    : $"LALAMOVE_QR_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}";

                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = refId,
                    Provider = provider,
                    PaymentMethod = normalizedPaymentMethod,
                    Amount = session.ExpectedAmount,
                    Status = PaymentStatus.Success
                });
            }

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = order.Fulfillment == FulfillmentType.Lalamove ? "Lalamove Payment Collected" : "Counter Pickup Collected",
                Changes = $"Store counter collected ₱{session.ExpectedAmount:N2} via {session.PaymentMethod}. Held in drawer by {staffUsername}.",
                ChangedBy = staffUsername,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return MapToStatusDto(session, order);
        }

        // 5b. Safeguard 3 — Staff Custody Undo
        public async Task<bool> RevertCustodyAsync(int orderId, string currentUser, bool isOwner)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
            {
                throw new KeyNotFoundException($"Order #{orderId} not found.");
            }

            if (order.SettlementCustodyStatus != "InStaffDrawer" &&
                order.SettlementCustodyStatus != "AwaitingOwnerDigitalVerification")
            {
                throw new InvalidOperationException($"Cannot revert custody: Order #{orderId} status is '{order.SettlementCustodyStatus}', expected an owner-verification state.");
            }

            // RBAC Guard: Ensure isOwner || string.Equals(order.StaffValidatedBy, currentUser, StringComparison.OrdinalIgnoreCase)
            if (!isOwner && !string.Equals(order.StaffValidatedBy, currentUser, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("Only the holding staff member or the Owner can revert drawer custody.");
            }

            order.SettlementCustodyStatus = "Uncollected";
            order.StaffValidatedBy = null;
            order.StaffValidatedAt = null;
            order.HeldByStaffMethod = null;
            order.HeldByStaffAmount = 0m;
            order.DigitalTransferMethod = null;
            order.DigitalTransferAmount = null;
            order.DigitalReferenceNote = null;
            order.RiderSignedBy = null;
            order.RiderRemittedAmount = null;
            order.RiderSignedAt = null;

            // Query any unclosed Hop 2 (HopStage == "StaffToOwner" && !IsUsed) SettlementQrSessions for this orderId and mark them Status = "Expired" and IsUsed = true
            var unclosedHop2Sessions = await _context.SettlementQrSessions
                .Where(s => s.OrderId == orderId && s.HopStage == "StaffToOwner" && !s.IsUsed)
                .ToListAsync();

            foreach (var s in unclosedHop2Sessions)
            {
                s.Status = "Expired";
                s.IsUsed = true;
            }

            // Write immutable record to OrderAuditLogs
            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = orderId,
                ActionType = "Custody Reverted",
                Changes = $"Custody for Order #{orderId} reverted from InStaffDrawer to Uncollected by {currentUser}",
                ChangedBy = currentUser,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return true;
        }

        // 6. Owner Verification & Final Settlement
        public async Task<QrSessionStatusDto> OwnerApproveQrSessionAsync(
            string token,
            OwnerApproveRequest? request,
            string? authenticatedUsername,
            bool isOwnerRole)
        {
            string? verifiedOwnerUsername = null;

            if (isOwnerRole && !string.IsNullOrWhiteSpace(authenticatedUsername))
            {
                verifiedOwnerUsername = authenticatedUsername;
            }
            else if (!string.IsNullOrWhiteSpace(request?.OwnerPinOrPassword))
            {
                var pinOrPassword = request.OwnerPinOrPassword.Trim();
                var ownerQuery = _context.Users.Where(u => u.Role == "Owner" && u.IsActive);
                if (!string.IsNullOrWhiteSpace(request.OwnerUsername))
                {
                    var reqUser = request.OwnerUsername.Trim().ToLower();
                    ownerQuery = ownerQuery.Where(u => u.Username.ToLower() == reqUser);
                }

                var candidateOwners = await ownerQuery.ToListAsync();
                foreach (var owner in candidateOwners)
                {
                    if (BCrypt.Net.BCrypt.Verify(pinOrPassword, owner.PasswordHash))
                    {
                        verifiedOwnerUsername = owner.Username;
                        break;
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(verifiedOwnerUsername))
            {
                throw new UnauthorizedAccessException("Invalid Owner credentials. Owner approval required.");
            }

            var session = await _context.SettlementQrSessions
                .Include(s => s.Order)
                    .ThenInclude(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.Token == token);

            if (session == null)
            {
                throw new KeyNotFoundException("QR session not found.");
            }

            if (session.IsUsed && session.Status == "ApprovedByOwner")
            {
                return MapToStatusDto(session, session.Order);
            }

            // Safeguard 4 — Owner Counted-Amount Enforcement
            if (request == null || request.CountedAmount != session.ExpectedAmount)
            {
                var counted = request?.CountedAmount ?? 0m;
                var isDigitalDeposit = Math.Max(0m, session.Order.HeldByStaffAmount ?? 0m) <= 0m &&
                    Math.Max(0m, session.Order.DigitalTransferAmount ?? 0m) > 0m;
                throw new ArgumentException(isDigitalDeposit
                    ? $"Verified account credit (₱{counted:N2}) does not match the expected digital deposit (₱{session.ExpectedAmount:N2}). Recheck the bank or wallet credit before closing."
                    : $"Counted bills (₱{counted:N2}) do not match expected remittance (₱{session.ExpectedAmount:N2}). Recount envelope before closing.");
            }

            if (DateTime.UtcNow > session.ExpiresAt && session.Status != "SignedByRider" && session.Status != "ValidatedByStaff")
            {
                session.Status = "Expired";
                await _context.SaveChangesAsync();
                throw new InvalidOperationException("This QR session has expired.");
            }

            session.Status = "ApprovedByOwner";
            session.OwnerApprovedBy = verifiedOwnerUsername;
            session.OwnerApprovedAt = DateTime.UtcNow;
            session.IsUsed = true;

            var order = session.Order;
            order.SettlementCustodyStatus = "Settled";
            order.OwnerApprovedBy = verifiedOwnerUsername;
            order.OwnerApprovedAt = DateTime.UtcNow;

            var heldCashAmount = Math.Max(0m, order.HeldByStaffAmount ?? 0m);
            var pendingDigitalAmount = Math.Max(0m, order.DigitalTransferAmount ?? 0m);
            var hasStructuredDigitalHandover = order.DigitalTransferAmount.HasValue;
            var requestedSettlementAmount = hasStructuredDigitalHandover
                ? heldCashAmount + pendingDigitalAmount
                : order.HeldByStaffAmount ??
                    (session.ExpectedAmount > 0
                        ? session.ExpectedAmount
                        : Math.Max(0, (order.GrandTotal > 0 ? order.GrandTotal : (order.Price + order.DeliveryFee - order.Discount)) - order.Downpayment));
            var grossTotal = order.GrandTotal > 0
                ? order.GrandTotal
                : order.Price + order.DeliveryFee - order.Discount;
            var isFullDigitalSettlement = heldCashAmount <= 0m && pendingDigitalAmount > 0m;
            var settlementTarget = order.Fulfillment == FulfillmentType.Delivery && !isFullDigitalSettlement
                ? Math.Max(0m, grossTotal - order.DeliveryFee)
                : Math.Max(0m, grossTotal);
            var activeLedgerTotal = await _context.PaymentLogs
                .Where(payment => payment.OrderId == order.Id
                                  && payment.Status == PaymentStatus.Success
                                  && !payment.IsVoided)
                .SumAsync(payment => (decimal?)payment.Amount) ?? 0m;
            var effectivePaid = Math.Max(order.Downpayment, activeLedgerTotal);
            var outstandingSettlement = Math.Max(0m, settlementTarget - effectivePaid);
            var cashAmountToCredit = hasStructuredDigitalHandover
                ? Math.Min(heldCashAmount, outstandingSettlement)
                : 0m;
            var digitalAmountToCredit = hasStructuredDigitalHandover
                ? Math.Min(pendingDigitalAmount, Math.Max(0m, outstandingSettlement - cashAmountToCredit))
                : 0m;
            var amountToSettle = hasStructuredDigitalHandover
                ? cashAmountToCredit + digitalAmountToCredit
                : Math.Min(Math.Max(0m, requestedSettlementAmount), outstandingSettlement);
            var ledgerRoom = Math.Max(0m, settlementTarget - activeLedgerTotal);
            var cashAmountToRecord = hasStructuredDigitalHandover
                ? Math.Min(heldCashAmount, ledgerRoom)
                : 0m;
            var digitalAmountToRecord = hasStructuredDigitalHandover
                ? Math.Min(pendingDigitalAmount, Math.Max(0m, ledgerRoom - cashAmountToRecord))
                : 0m;
            var legacyAmountToRecord = hasStructuredDigitalHandover
                ? 0m
                : Math.Min(Math.Max(0m, requestedSettlementAmount), ledgerRoom);

            // Final handover collections are credited to PaymentLogs and transition custody to Settled.
            // Order.Downpayment represents the original advance booking downpayment and must not be inflated.

            if (hasStructuredDigitalHandover)
            {
                if (cashAmountToRecord > 0m)
                {
                    _context.PaymentLogs.Add(new PaymentLog
                    {
                        OrderId = order.Id,
                        GatewayReferenceId = $"OWNER_CASH_{order.Id}_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}",
                        Provider = PaymentProvider.Cash,
                        PaymentMethod = "Cash",
                        Amount = cashAmountToRecord,
                        Status = PaymentStatus.Success,
                        RecordedBy = verifiedOwnerUsername
                    });
                }

                if (digitalAmountToRecord > 0m)
                {
                    var digitalMethod = order.DigitalTransferMethod ?? session.PaymentMethod;
                    var digitalRef = !string.IsNullOrWhiteSpace(order.DigitalReferenceNote)
                        ? order.DigitalReferenceNote
                        : !string.IsNullOrWhiteSpace(session.ReferenceNumber)
                            ? session.ReferenceNumber
                            : $"OWNER_DIGITAL_{order.Id}_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}";
                    var baseReference = $"{digitalRef}_ORDER_{order.Id}";
                    var referenceExists = await _context.PaymentLogs
                        .AnyAsync(payment => payment.GatewayReferenceId == baseReference);
                    _context.PaymentLogs.Add(new PaymentLog
                    {
                        OrderId = order.Id,
                        GatewayReferenceId = referenceExists
                            ? $"{baseReference}_VERIFY_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}"
                            : baseReference,
                        Provider = PaymentChannels.ToProvider(digitalMethod),
                        PaymentMethod = PaymentChannels.Normalize(digitalMethod),
                        Amount = digitalAmountToRecord,
                        Status = PaymentStatus.Success,
                        RecordedBy = verifiedOwnerUsername
                    });
                }
            }
            else if (legacyAmountToRecord > 0m)
            {
                var normalizedPaymentMethod = PaymentChannels.Normalize(session.PaymentMethod);
                var refId = session.ReferenceNumber;
                if (string.IsNullOrWhiteSpace(refId))
                {
                    refId = $"QR_SETTLE_{session.Token[..Math.Min(8, session.Token.Length)].ToUpperInvariant()}_{Guid.NewGuid().ToString()[..4]}";
                }
                else if (await _context.PaymentLogs.AnyAsync(payment => payment.GatewayReferenceId == refId))
                {
                    refId = $"{refId}_VERIFY_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}";
                }

                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = refId,
                    Provider = PaymentChannels.ToProvider(normalizedPaymentMethod),
                    PaymentMethod = normalizedPaymentMethod,
                    Amount = legacyAmountToRecord,
                    Status = PaymentStatus.Success,
                    RecordedBy = verifiedOwnerUsername
                });
            }

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Custody: Settled by Owner",
                Changes = hasStructuredDigitalHandover
                    ? $"Owner {verifiedOwnerUsername} verified settlement of ₱{heldCashAmount:N2} physical cash and ₱{pendingDigitalAmount:N2} digital transfer. Credited ₱{amountToSettle:N2} without exceeding the outstanding store balance. Ref: {order.DigitalReferenceNote}. Order marked Settled."
                    : $"Owner {verifiedOwnerUsername} verified and approved custody settlement of ₱{amountToSettle:N2} via {session.PaymentMethod}. Order marked Settled.",
                ChangedBy = verifiedOwnerUsername,
                Timestamp = DateTime.UtcNow
            });

            order.HeldByStaffAmount = 0m;
            order.HeldByStaffMethod = null;
            order.DigitalTransferAmount = 0m;
            order.DigitalTransferMethod = null;
            order.DigitalReferenceNote = null;

            var storeNetTotal = Math.Max(0, order.GrandTotal - order.DeliveryFee);
            if (order.Fulfillment == FulfillmentType.Delivery && (order.SettlementCustodyStatus == "Settled" || order.Downpayment >= storeNetTotal))
            {
                order.RoutingStatus = DeliveryStatus.Delivered;
                if (order.DeliveryTrip != null)
                {
                    order.DeliveryTrip.Status = DeliveryStatus.Delivered;
                    order.DeliveryTrip.ActualReturnTime = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
            return MapToStatusDto(session, order);
        }

        // 7. Legacy Direct Store GCash endpoint: log Hop 1 only; Owner still performs Hop 2.
        public async Task<bool> SettleDirectStoreGcashAsync(int orderId, decimal amount, string referenceNumber, string staffUsername)
        {
            var order = await _context.Orders
                .Include(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
            {
                throw new ArgumentException($"Order #{orderId} not found.");
            }

            if (string.IsNullOrWhiteSpace(referenceNumber))
            {
                throw new ArgumentException("Bank Name / Reference Note is required for Direct GCash.");
            }

            order.SettlementCustodyStatus = "AwaitingOwnerDigitalVerification";
            order.HeldByStaffMethod = "DirectGCash";
            order.HeldByStaffAmount = 0m;
            order.DigitalTransferMethod = "DirectGCash";
            order.DigitalTransferAmount = amount;
            order.DigitalReferenceNote = referenceNumber.Trim();
            // Direct-to-Owner means the rider physically remitted nothing.
            order.RiderRemittedAmount = 0m;
            order.RiderSignedBy = order.DeliveryTrip?.RiderName ?? order.RiderSignedBy;
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Digital Transfer: Awaiting Owner Verification",
                Changes = $"Direct Store GCash payment of ₱{amount:N2} logged with Ref: {referenceNumber.Trim()}. Physical drawer received ₱0.00. Awaiting Owner verification.",
                ChangedBy = staffUsername,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> VerifyDigitalSettlementAsync(int orderId, string ownerUsername)
        {
            var order = await _context.Orders
                .Include(o => o.DeliveryTrip)
                .FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
            {
                throw new KeyNotFoundException($"Order #{orderId} not found.");
            }
            if (order.Fulfillment != FulfillmentType.Pickup && order.Fulfillment != FulfillmentType.Delivery)
            {
                throw new InvalidOperationException("Digital owner verification is available only for Store Pickup and freelance-rider Delivery orders.");
            }
            if (order.SettlementCustodyStatus != "AwaitingOwnerDigitalVerification"
                && order.SettlementCustodyStatus != "InStaffDrawer")
            {
                throw new InvalidOperationException($"Order #{orderId} is not awaiting Owner settlement verification.");
            }

            var pendingDigitalAmount = Math.Max(0m, order.DigitalTransferAmount ?? 0m);
            var heldCashAmount = Math.Max(0m, order.HeldByStaffAmount ?? 0m);
            if (pendingDigitalAmount <= 0m)
            {
                throw new InvalidOperationException($"Order #{orderId} has no pending digital deposit to verify.");
            }

            var digitalMethod = PaymentChannels.Normalize(order.DigitalTransferMethod ?? order.HeldByStaffMethod, "GCash");
            var digitalReference = !string.IsNullOrWhiteSpace(order.DigitalReferenceNote)
                ? order.DigitalReferenceNote.Trim()
                : $"OWNER_DIGITAL_{order.Id}_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}";
            var grossTotal = order.GrandTotal > 0m
                ? order.GrandTotal
                : order.Price + order.DeliveryFee - order.Discount;
            var isFullDigitalSettlement = heldCashAmount <= 0m && pendingDigitalAmount > 0m;
            var settlementTarget = order.Fulfillment == FulfillmentType.Delivery && !isFullDigitalSettlement
                ? Math.Max(0m, grossTotal - order.DeliveryFee)
                : Math.Max(0m, grossTotal);

            var activeLedgerTotal = await _context.PaymentLogs
                .Where(payment => payment.OrderId == order.Id
                                  && payment.Status == PaymentStatus.Success
                                  && !payment.IsVoided)
                .SumAsync(payment => (decimal?)payment.Amount) ?? 0m;
            var effectivePaid = Math.Max(order.Downpayment, activeLedgerTotal);
            var outstandingSettlement = Math.Max(0m, settlementTarget - effectivePaid);
            var handoverTotal = heldCashAmount + pendingDigitalAmount;
            if (handoverTotal < outstandingSettlement)
            {
                throw new InvalidOperationException(
                    $"Pending custody of ₱{handoverTotal:N2} does not cover the outstanding store balance of ₱{outstandingSettlement:N2}.");
            }

            // Final digital deposit settlements are recorded in PaymentLogs and transition custody to Settled.
            // Advance booking downpayment (Order.Downpayment) is strictly preserved without inflation.

            // The ledger and cached total may differ for legacy records. Fill only the remaining
            // ledger room so verification never creates a duplicate or over-credit.
            var ledgerRoom = Math.Max(0m, settlementTarget - activeLedgerTotal);
            var digitalAmountToRecord = Math.Min(pendingDigitalAmount, ledgerRoom);
            var cashAmountToRecord = Math.Min(heldCashAmount, Math.Max(0m, ledgerRoom - digitalAmountToRecord));

            if (digitalAmountToRecord > 0m)
            {
                var baseReference = $"{digitalReference}_ORDER_{order.Id}";
                var referenceExists = await _context.PaymentLogs
                    .AnyAsync(payment => payment.GatewayReferenceId == baseReference);
                var ledgerReference = referenceExists
                    ? $"{baseReference}_VERIFY_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}"
                    : baseReference;
                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = ledgerReference,
                    Provider = PaymentChannels.ToProvider(digitalMethod),
                    PaymentMethod = digitalMethod,
                    Amount = digitalAmountToRecord,
                    Status = PaymentStatus.Success,
                    RecordedBy = ownerUsername
                });
            }
            if (cashAmountToRecord > 0m)
            {
                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = $"OWNER_CASH_{order.Id}_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}",
                    Provider = PaymentProvider.Cash,
                    PaymentMethod = "Cash",
                    Amount = cashAmountToRecord,
                    Status = PaymentStatus.Success,
                    RecordedBy = ownerUsername
                });
            }

            order.SettlementCustodyStatus = "Settled";
            order.OwnerApprovedBy = ownerUsername;
            order.OwnerApprovedAt = DateTime.UtcNow;
            order.HeldByStaffAmount = 0m;
            order.HeldByStaffMethod = null;
            order.DigitalTransferAmount = 0m;
            order.DigitalTransferMethod = null;
            order.DigitalReferenceNote = null;
            order.UpdatedAt = DateTime.UtcNow;

            if (order.Fulfillment == FulfillmentType.Delivery && (order.SettlementCustodyStatus == "Settled" || order.Downpayment >= settlementTarget))
            {
                order.RoutingStatus = DeliveryStatus.Delivered;
                if (order.DeliveryTrip != null)
                {
                    order.DeliveryTrip.Status = DeliveryStatus.Delivered;
                    order.DeliveryTrip.ActualReturnTime = DateTime.UtcNow;
                }
            }

            var activeHopTwoSessions = await _context.SettlementQrSessions
                .Where(session => session.OrderId == order.Id
                                  && session.HopStage == "StaffToOwner"
                                  && !session.IsUsed)
                .ToListAsync();
            foreach (var session in activeHopTwoSessions)
            {
                session.Status = "ApprovedByOwner";
                session.OwnerApprovedBy = ownerUsername;
                session.OwnerApprovedAt = DateTime.UtcNow;
                session.IsUsed = true;
            }

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Digital Deposit Verified by Owner",
                Changes = $"Owner {ownerUsername} verified ₱{pendingDigitalAmount:N2} via {digitalMethod}. Ref: {digitalReference}. Physical cash included: ₱{heldCashAmount:N2}. Order marked Settled; pending digital and drawer amounts cleared.",
                ChangedBy = ownerUsername,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return true;
        }

        private static QrSessionStatusDto MapToStatusDto(SettlementQrSession session, Order order)
        {
            return new QrSessionStatusDto
            {
                Token = session.Token,
                OrderId = session.OrderId,
                CustomerName = order.CustomerName,
                AssignedRiderName = order.DeliveryTrip?.RiderName ?? session.RiderSignedBy ?? order.RiderSignedBy ?? "Unassigned",
                HopStage = session.HopStage,
                PaymentMethod = session.PaymentMethod,
                ExpectedAmount = session.ExpectedAmount,
                Status = session.Status,
                RiderSignedBy = session.RiderSignedBy,
                RiderRemittedAmount = session.RiderRemittedAmount,
                RiderSignedAt = session.RiderSignedAt,
                StaffValidatedBy = session.StaffValidatedBy,
                StaffValidatedAt = session.StaffValidatedAt,
                OwnerApprovedBy = session.OwnerApprovedBy,
                OwnerApprovedAt = session.OwnerApprovedAt,
                ExpiresAt = session.ExpiresAt,
                IsUsed = session.IsUsed,
                WasRejected = false
            };
        }
    }
}
