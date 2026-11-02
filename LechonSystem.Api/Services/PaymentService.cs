using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Data;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.Common;
using LechonSystem.Api.DTOs;

using Microsoft.AspNetCore.Http;

namespace LechonSystem.Api.Services
{
    public class PaymentService
    {
        private readonly LechonDbContext _context;
        private readonly IOrderService _orderService;
        private readonly IHttpContextAccessor _httpContextAccessor;

        private string CurrentUser => UserIdentityHelper.ResolveDisplayName(_httpContextAccessor.HttpContext?.User);

        public PaymentService(LechonDbContext context, IOrderService orderService, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _orderService = orderService; // Now this maps perfectly!
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<bool> ProcessPaymentAsync(
            int orderId,
            decimal amount,
            string referenceId,
            PaymentProvider provider,
            string? paymentMethod = null)
        {
            // 1. Strict Idempotency Check: Have we processed this transaction reference before?
            var existingPayment = await _context.PaymentLogs
                .FirstOrDefaultAsync(p => p.GatewayReferenceId == referenceId);

            if (existingPayment != null && existingPayment.Status == PaymentStatus.Success)
            {
                // Core Idempotency Rule: Safely return true without altering state or double-locking inventory
                return true;
            }

            // 2. Locate the master order
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
            {
                throw new ArgumentException($"Validation Error: Order ID {orderId} does not exist.");
            }

            // 3. Validation Logic: Cross-check payment balance against order requirements
            // For a production system, you want to ensure they aren't passing zero or negative numbers
            if (amount <= 0)
            {
                throw new ArgumentException("Validation Error: Payment amount must be greater than zero.");
            }

            // 4. Create the audit trail log
            var normalizedPaymentMethod = PaymentChannels.Normalize(
                paymentMethod,
                PaymentChannels.FromProvider(provider));

            var paymentLog = new PaymentLog
            {
                OrderId = orderId,
                GatewayReferenceId = referenceId,
                Provider = provider,
                PaymentMethod = normalizedPaymentMethod,
                Amount = amount,
                Status = PaymentStatus.Success
            };

            _context.PaymentLogs.Add(paymentLog);

            var hadPayment = order.Downpayment > 0;
            order.Downpayment += amount;
            if (!hadPayment)
            {
                order.DownpaymentMethod = normalizedPaymentMethod;
            }

            // 🚀 THE BLACK BOX: Record the financial event in the Order Audit Trail
            var auditLog = new OrderAuditLog
            {
                OrderId = orderId,
                ActionType = "Payment Logged",
                // We use {amount:N2} so it formats the number beautifully (e.g., 3,000.00)
                Changes = $"Logged payment of ₱{amount:N2} via {normalizedPaymentMethod}",
                ChangedBy = CurrentUser,
                Timestamp = DateTime.UtcNow
            };

            _context.OrderAuditLogs.Add(auditLog);

            await _context.SaveChangesAsync();

            // 5. Shared Trigger: Wire successful matches to automatically lock reservations
            await _orderService.ConfirmPaymentAsync(orderId);

            return true;
        }

        public async Task<bool> ProcessSplitPaymentAsync(
            int orderId,
            IReadOnlyList<PaymentSplitDto> splits)
        {
            if (splits.Count != 2 || splits.Any(split => split.Amount <= 0))
            {
                throw new ArgumentException("Split payment requires exactly two positive amounts.");
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable);
            var order = await _context.Orders
                .Include(o => o.OrderItems)
                .FirstOrDefaultAsync(o => o.Id == orderId)
                ?? throw new ArgumentException($"Validation Error: Order ID {orderId} does not exist.");

            var normalized = splits.Select((split, index) => new
            {
                split.Amount,
                Method = PaymentChannels.Normalize(split.PaymentMethod),
                Reference = string.IsNullOrWhiteSpace(split.ReferenceNumber)
                    ? $"SPLIT_{orderId}_{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}_{index + 1}"
                    : split.ReferenceNumber.Trim()
            }).ToList();

            var references = normalized.Select(split => split.Reference).ToList();
            if (references.Distinct(StringComparer.OrdinalIgnoreCase).Count() != references.Count ||
                await _context.PaymentLogs.AnyAsync(payment => references.Contains(payment.GatewayReferenceId)))
            {
                throw new ArgumentException("Each split payment reference must be unique.");
            }

            foreach (var split in normalized)
            {
                _context.PaymentLogs.Add(new PaymentLog
                {
                    OrderId = orderId,
                    GatewayReferenceId = split.Reference,
                    Provider = PaymentChannels.ToProvider(split.Method),
                    PaymentMethod = split.Method,
                    Amount = split.Amount,
                    Status = PaymentStatus.Success
                });
            }

            order.Downpayment += normalized.Sum(split => split.Amount);
            order.DownpaymentMethod = normalized[^1].Method;
            _context.OrderAuditLogs.Add(new OrderAuditLog
            {
                OrderId = orderId,
                ActionType = "Split Payment Logged",
                Changes = $"Split payment recorded: ₱{normalized[0].Amount:N2} via {normalized[0].Method} + ₱{normalized[1].Amount:N2} via {normalized[1].Method}.",
                ChangedBy = CurrentUser,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            await _orderService.ConfirmPaymentAsync(orderId);
            return true;
        }
    }
}
