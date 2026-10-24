using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;

using Microsoft.AspNetCore.Authorization;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api")]
    public class PaymentWebhookController : ControllerBase
    {
        private readonly PaymentService _paymentService;

        public PaymentWebhookController(PaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        // --- DOOR 1: AUTOMATED GATEWAY WEBHOOK ENTRANCE ---
        [HttpPost("webhooks/payments/{provider}")]
        [AllowAnonymous]
        public async Task<IActionResult> HandleGatewayWebhook(string provider, [FromBody] WebhookPaymentDto dto)
        {
            try
            {
                // Convert the incoming URL text string into our official C# Enum format safely
                if (!Enum.TryParse<PaymentProvider>(provider, true, out var parsedProvider))
                {
                    return BadRequest(new { message = $"Error: '{provider}' is not a recognized payment gateway." });
                }

                // Pass the task to the service brain
                await _paymentService.ProcessPaymentAsync(dto.OrderId, dto.Amount, dto.ReferenceId, parsedProvider);
                
                // Gateways expect a clean HTTP 200 OK to acknowledge they should stop sending retries
                return Ok(new { message = "Webhook received and verified successfully." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception)
            {
                return StatusCode(500, new { message = "An internal server error occurred while processing the webhook." });
            }
        }

        // --- DOOR 2: CASHIER MANUAL DASHBOARD ENTRANCE ---
        [HttpPost("internal/payments/manual")]
        [Authorize(Roles = "Owner,Cashier")]
        public async Task<IActionResult> HandleManualPayment([FromBody] ManualPaymentDto dto)
        {
            try
            {
                // Pick up either ReferenceNumber or ReferenceId
                var refId = !string.IsNullOrWhiteSpace(dto.ReferenceNumber) ? dto.ReferenceNumber : dto.ReferenceId;
                if (string.IsNullOrWhiteSpace(refId))
                {
                    refId = $"MANUAL_{Guid.NewGuid().ToString().Substring(0, 8)}";
                }

                // Support both string PaymentMethod ("Physical Cash", "Store GCash") and Provider enum
                var provider = dto.Provider ?? PaymentProvider.Cash;
                var paymentMethod = PaymentChannels.FromProvider(provider);
                if (!string.IsNullOrWhiteSpace(dto.PaymentMethod))
                {
                    paymentMethod = PaymentChannels.Normalize(dto.PaymentMethod);
                    provider = PaymentChannels.ToProvider(paymentMethod);
                }

                // Pass manual inputs straight into the exact same verification brain
                await _paymentService.ProcessPaymentAsync(dto.OrderId, dto.Amount, refId, provider, paymentMethod);
                
                return Ok(new { message = "Manual payment recorded successfully. Reservation locked!" });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An internal server error occurred while processing manual payment.", error = ex.Message });
            }
        }
    }

    // --- DATA PASSING DTO BLOCKS ---
    
    // The standard data block incoming from an automated gateway system
    public class WebhookPaymentDto
    {
        public int OrderId { get; set; }
        public decimal Amount { get; set; }
        public string ReferenceId { get; set; } = string.Empty;
    }

    // The data block filled out by your dashboard cashier or counter staff
    public class ManualPaymentDto
    {
        public int OrderId { get; set; }
        public decimal Amount { get; set; }
        public string ReferenceId { get; set; } = string.Empty;
        public string? ReferenceNumber { get; set; }
        public PaymentProvider? Provider { get; set; } // Cash, ManualGCash, BankTransfer, etc.
        public string? PaymentMethod { get; set; }     // E.g., "Physical Cash", "Store GCash"
    }
}
