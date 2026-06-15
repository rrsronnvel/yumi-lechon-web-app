using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public class PaymentService
    {
        private readonly LechonDbContext _context;
        // DELETE THE CONCRETE OrderService LINE, ONLY KEEP THIS ONE:
        private readonly IOrderService _orderService;

        public PaymentService(LechonDbContext context, IOrderService orderService)
        {
            _context = context;
            _orderService = orderService; // Now this maps perfectly!
        }

        public async Task<bool> ProcessPaymentAsync(int orderId, decimal amount, string referenceId, PaymentProvider provider)
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
            var paymentLog = new PaymentLog
            {
                OrderId = orderId,
                GatewayReferenceId = referenceId,
                Provider = provider,
                Amount = amount,
                Status = PaymentStatus.Success // Setting to success since validation passed
            };

            _context.PaymentLogs.Add(paymentLog);
            await _context.SaveChangesAsync();

            // 5. Shared Trigger: Wire successful matches to automatically lock reservations
            // This invokes your Task 5 method to transition the reservation from Pending to Committed/Locked
            await _orderService.ConfirmPaymentAsync(orderId);

            return true;
        }
    }
}