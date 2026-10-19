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

        // 1. Fetching unassigned orders
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

            var ordersToAssign = await _context.Orders
                .Include(o => o.OrderItems)
                    .ThenInclude(i => i.OrderItemSchedule)
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
                    throw new InvalidOperationException($"Order #{order.Id} is a {order.Fulfillment} order and cannot be assigned to a delivery trip.");
                }
            }

            var newTrip = new DeliveryTrip
            {
                RiderName = riderName,
                VehicleType = vehicleType,
                Status = DeliveryStatus.Assigned,
                DispatchTime = DateTime.UtcNow
            };

            foreach (var order in ordersToAssign)
            {
                order.RoutingStatus = DeliveryStatus.Assigned;
                newTrip.Orders.Add(order);

                string message = $"Internal Log: Rider {riderName} assigned for tomorrow's delivery route.";
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
            }

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

        // Tab 1: Freelance Rider Settlements (Remains visible while SettlementCustodyStatus != "Settled")
        public async Task<IEnumerable<PendingSettlementDropDto>> GetPendingSettlementDropsAsync()
        {
            return await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryTrip)
                .Where(o => o.DeliveryTripId != null
                         && o.Fulfillment == FulfillmentType.Delivery
                         && !o.IsCancelled
                         && o.SettlementCustodyStatus != "Settled"
                         && ((o.GrandTotal - o.Downpayment) - o.DeliveryFee) > 0)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new PendingSettlementDropDto
                {
                    Id = o.Id,
                    OrderId = o.Id,
                    RiderName = o.DeliveryTrip != null ? o.DeliveryTrip.RiderName : (o.RiderSignedBy ?? "Unassigned"),
                    CustomerName = o.CustomerName,
                    IsTrustedCustomer = o.IsTrustedCustomer,
                    DeliveryAddress = o.DeliveryAddress,
                    TotalCollected = o.GrandTotal - o.Downpayment,
                    RiderDeliveryFee = o.DeliveryFee,
                    NetRemittance = (o.GrandTotal - o.Downpayment) - o.DeliveryFee,
                    CustodyStatus = string.IsNullOrEmpty(o.SettlementCustodyStatus) ? "Uncollected" : o.SettlementCustodyStatus,
                    RiderSignedBy = o.RiderSignedBy,
                    HeldByStaffName = o.StaffValidatedBy,
                    HeldPaymentMethod = o.HeldByStaffMethod
                })
                .ToListAsync();
        }

        // Tab 2: Walk-in Store Pickup Handovers (Counter Settlement)
        // Remains visible while SettlementCustodyStatus != "Settled" and balance > 0
        public async Task<IEnumerable<PendingPickupSettlementDto>> GetPendingPickupSettlementsAsync()
        {
            return await _context.Orders
                .AsNoTracking()
                .Where(o => o.Fulfillment == FulfillmentType.Pickup
                         && !o.IsCancelled
                         && o.SettlementCustodyStatus != "Settled"
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
                    Remarks = o.Remarks,
                    CustodyStatus = string.IsNullOrEmpty(o.SettlementCustodyStatus) ? "Uncollected" : o.SettlementCustodyStatus,
                    RiderSignedBy = o.RiderSignedBy,
                    HeldByStaffName = o.StaffValidatedBy,
                    HeldPaymentMethod = o.HeldByStaffMethod
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

            // If rider's phone is dead, manual counter override supplies details
            if (!string.IsNullOrWhiteSpace(request?.ManualOverrideRiderName))
            {
                session.RiderSignedBy = request.ManualOverrideRiderName.Trim();
                session.RiderRemittedAmount = request.ManualOverrideAmount ?? session.ExpectedAmount;
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
            order.SettlementCustodyStatus = "InStaffDrawer";
            order.HeldByStaffMethod = session.PaymentMethod;
            order.RiderSignedBy = session.RiderSignedBy;
            order.RiderRemittedAmount = session.RiderRemittedAmount;
            order.RiderSignedAt = session.RiderSignedAt;
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Custody: In Staff Drawer",
                Changes = $"Rider {session.RiderSignedBy} remitted ₱{session.RiderRemittedAmount:N2} via {session.PaymentMethod}. Validated into drawer by {staffUsername}.",
                ChangedBy = staffUsername,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return MapToStatusDto(session, order);
        }

        // 5. Store Counter Collection (Tab 2: Walk-in Store Pickups)
        public async Task<bool> CounterCollectPickupAsync(int orderId, string paymentMethod, string staffUsername, decimal? amount = null, string? referenceNumber = null)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
            {
                throw new ArgumentException($"Order #{orderId} not found.");
            }

            var balance = (order.GrandTotal > 0 ? order.GrandTotal : (order.Price + order.DeliveryFee - order.Discount)) - order.Downpayment;
            var collectedAmount = amount ?? balance;

            order.SettlementCustodyStatus = "InStaffDrawer";
            order.HeldByStaffMethod = paymentMethod;
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Counter Pickup Collected",
                Changes = $"Store counter collected ₱{collectedAmount:N2} via {paymentMethod}. Held in drawer by {staffUsername}.",
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
            order.SettlementCustodyStatus = "InStaffDrawer";
            order.HeldByStaffMethod = session.PaymentMethod;
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Counter Pickup Collected",
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

            if (order.SettlementCustodyStatus != "InStaffDrawer")
            {
                throw new InvalidOperationException($"Cannot revert custody: Order #{orderId} status is '{order.SettlementCustodyStatus}', expected 'InStaffDrawer'.");
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
                throw new ArgumentException($"Counted bills (₱{counted:N2}) do not match expected remittance (₱{session.ExpectedAmount:N2}). Recount envelope before closing.");
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

            decimal amountToSettle = session.ExpectedAmount > 0
                ? session.ExpectedAmount
                : Math.Max(0, (order.GrandTotal > 0 ? order.GrandTotal : (order.Price + order.DeliveryFee - order.Discount)) - order.Downpayment);

            if (amountToSettle > 0)
            {
                order.Downpayment += amountToSettle;

                PaymentProvider provider = PaymentProvider.Cash;
                if (session.PaymentMethod == "ManualGCash") provider = PaymentProvider.ManualGCash;
                else if (session.PaymentMethod == "GCash") provider = PaymentProvider.GCash;

                var refId = session.ReferenceNumber;
                if (string.IsNullOrWhiteSpace(refId))
                {
                    refId = $"QR_SETTLE_{session.Token[..Math.Min(8, session.Token.Length)].ToUpperInvariant()}_{Guid.NewGuid().ToString()[..4]}";
                }

                var paymentLog = new PaymentLog
                {
                    OrderId = order.Id,
                    GatewayReferenceId = refId,
                    Provider = provider,
                    Amount = amountToSettle,
                    Status = PaymentStatus.Success
                };
                _context.PaymentLogs.Add(paymentLog);

                _context.OrderAuditLogs.Add(new OrderAuditLog
                {
                    OrderId = order.Id,
                    ActionType = "Custody: Settled by Owner",
                    Changes = $"Owner {verifiedOwnerUsername} verified and approved custody settlement of ₱{amountToSettle:N2} via {session.PaymentMethod}. Order marked Settled.",
                    ChangedBy = verifiedOwnerUsername,
                    Timestamp = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            return MapToStatusDto(session, order);
        }

        // 7. Direct Store GCash Bypass Settlement
        public async Task<bool> SettleDirectStoreGcashAsync(int orderId, decimal amount, string referenceNumber, string staffUsername)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
            {
                throw new ArgumentException($"Order #{orderId} not found.");
            }

            order.SettlementCustodyStatus = "Settled";
            order.HeldByStaffMethod = "GCash";
            order.StaffValidatedBy = staffUsername;
            order.StaffValidatedAt = DateTime.UtcNow;
            order.OwnerApprovedBy = staffUsername;
            order.OwnerApprovedAt = DateTime.UtcNow;
            order.Downpayment += amount;

            var refId = !string.IsNullOrWhiteSpace(referenceNumber)
                ? referenceNumber
                : $"GCASH_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}";

            var paymentLog = new PaymentLog
            {
                OrderId = order.Id,
                GatewayReferenceId = refId,
                Provider = PaymentProvider.GCash,
                Amount = amount,
                Status = PaymentStatus.Success
            };
            _context.PaymentLogs.Add(paymentLog);

            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = order.Id,
                ActionType = "Direct GCash Settlement",
                Changes = $"Direct Store GCash payment of ₱{amount:N2} settled with Ref #{refId}. Verified by {staffUsername}.",
                ChangedBy = staffUsername,
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