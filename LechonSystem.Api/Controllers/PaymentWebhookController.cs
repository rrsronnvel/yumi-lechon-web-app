using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;

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
        public async Task<IActionResult> HandleManualPayment([FromBody] ManualPaymentDto dto)
        {
            try
            {
              
                // This prevents the Idempotency guard from silently blocking multiple cash drops.
                if (string.IsNullOrWhiteSpace(dto.ReferenceId))
                {
                    dto.ReferenceId = $"MANUAL_{Guid.NewGuid().ToString().Substring(0, 8)}";
                }

                // Pass manual inputs straight into the exact same verification brain
                await _paymentService.ProcessPaymentAsync(dto.OrderId, dto.Amount, dto.ReferenceId, dto.Provider);
                
                return Ok(new { message = "Manual payment recorded successfully. Reservation locked!" });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            // ...
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

    // The data block filled out by your dashboard cashier
    public class ManualPaymentDto
    {
        public int OrderId { get; set; }
        public decimal Amount { get; set; }
        public string ReferenceId { get; set; } = string.Empty;
        public PaymentProvider Provider { get; set; } // Cash, ManualGCash, BankTransfer, etc.
    }
}