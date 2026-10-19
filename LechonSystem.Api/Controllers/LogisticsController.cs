using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.Services;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Owner,Cashier")]
    public class LogisticsController : ControllerBase
    {
        private readonly ILogisticsService _logisticsService;

        public LogisticsController(ILogisticsService logisticsService)
        {
            _logisticsService = logisticsService;
        }

        // 1. GET: api/logistics/unassigned
        [HttpGet("unassigned")]
        public async Task<IActionResult> GetUnassignedOrders()
        {
            var unassignedOrders = await _logisticsService.GetUnassignedDeliveryOrdersAsync();
            return Ok(unassignedOrders);
        }

        // 2. POST: api/logistics/assign-rider
        [HttpPost("assign-rider")]
        public async Task<IActionResult> AssignRider([FromBody] AssignRiderRequest request)
        {
            try
            {
                var assignedTrip = await _logisticsService.AssignRiderAsync(
                    request.RiderName,
                    request.VehicleType,
                    request.OrderIds
                );

                return Ok(assignedTrip);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An unexpected error occurred during dispatch allocation.", error = ex.Message });
            }
        }

        // 3. GET: api/logistics/today
        [HttpGet("today")]
        public async Task<IActionResult> GetTodayDispatches()
        {
            var todayDispatches = await _logisticsService.GetTodayDispatchesAsync();
            return Ok(todayDispatches);
        }

        // 4. GET: api/logistics/trips/pending-settlement
        [HttpGet("trips/pending-settlement")]
        public async Task<IActionResult> GetPendingSettlements()
        {
            var pendingDrops = await _logisticsService.GetPendingSettlementDropsAsync();
            return Ok(pendingDrops);
        }

        // 5. GET: api/logistics/settlements/pickups
        [HttpGet("settlements/pickups")]
        public async Task<IActionResult> GetPendingPickupSettlements()
        {
            var pickups = await _logisticsService.GetPendingPickupSettlementsAsync();
            return Ok(pickups);
        }

        // 6. GET: api/logistics/settlements/lalamove
        [HttpGet("settlements/lalamove")]
        public async Task<IActionResult> GetPendingLalamoveSettlements()
        {
            var lalamove = await _logisticsService.GetPendingLalamoveSettlementsAsync();
            return Ok(lalamove);
        }

        // 7. POST: api/logistics/settlements/lalamove/{orderId}/release
        [HttpPost("settlements/lalamove/{orderId}/release")]
        public async Task<IActionResult> ConfirmLalamoveRelease(int orderId)
        {
            try
            {
                var result = await _logisticsService.ConfirmLalamoveReleaseAsync(orderId);
                return Ok(new { success = result, message = $"Order #{orderId} successfully released to Lalamove courier." });
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An unexpected error occurred during courier release.", error = ex.Message });
            }
        }

        // ==========================================
        // TWO-HOP QR CUSTODY CHAIN ENDPOINTS
        // ==========================================

        // 1. Create QR Session
        [HttpPost("settlements/qr-session")]
        public async Task<IActionResult> CreateQrSession([FromBody] CreateQrSessionRequest request)
        {
            try
            {
                var session = await _logisticsService.CreateQrSessionAsync(request);
                return Ok(session);
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error generating QR session.", error = ex.Message });
            }
        }

        // 2. Poll QR Session Status (Public / AllowAnonymous)
        [HttpGet("settlements/qr-session/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetQrSession(string token)
        {
            var session = await _logisticsService.GetQrSessionByTokenAsync(token);
            if (session == null)
            {
                return NotFound(new { message = "QR session not found or invalid." });
            }
            return Ok(session);
        }

        // 3. Rider Digital Signature (Public / AllowAnonymous)
        [HttpPost("settlements/qr-session/{token}/rider-sign")]
        [AllowAnonymous]
        public async Task<IActionResult> RiderSign(string token, [FromBody] RiderSignRequest request)
        {
            try
            {
                var session = await _logisticsService.RiderSignQrSessionAsync(token, request);
                return Ok(session);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to record rider signature.", error = ex.Message });
            }
        }

        // 3b. Safeguard 1 — Discrepancy Rejection
        [HttpPost("settlements/qr-session/{token}/reject")]
        [Authorize(Roles = "Owner,Cashier")]
        public async Task<IActionResult> RejectRiderSignature(string token)
        {
            try
            {
                var session = await _logisticsService.RejectRiderSignatureAsync(token);
                return Ok(session);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to reject rider signature.", error = ex.Message });
            }
        }

        // 4. Staff Validates Cash into Drawer
        [HttpPost("settlements/qr-session/{token}/staff-validate")]
        public async Task<IActionResult> StaffValidate(string token, [FromBody] StaffValidateRequest? request)
        {
            try
            {
                var staffUsername = User.Identity?.Name ?? "Cashier";
                var session = await _logisticsService.StaffValidateQrSessionAsync(token, request, staffUsername);
                return Ok(session);
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to validate drawer custody.", error = ex.Message });
            }
        }

        // 4b. Safeguard 3 — Staff Custody Undo
        [HttpPost("settlements/orders/{orderId}/revert-custody")]
        [Authorize(Roles = "Owner,Cashier")]
        public async Task<IActionResult> RevertCustody(int orderId)
        {
            try
            {
                var currentUser = User.Identity?.Name ?? "System";
                var isOwner = User.IsInRole("Owner");
                await _logisticsService.RevertCustodyAsync(orderId, currentUser, isOwner);
                return Ok(new { success = true, message = $"Custody for Order #{orderId} reverted to Uncollected." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to revert custody.", error = ex.Message });
            }
        }

        // 5. Store Counter Collection (Tab 2: Walk-in Store Pickups)
        [HttpPost("settlements/qr-session/{token}/counter-collect")]
        public async Task<IActionResult> CounterCollectQr(string token)
        {
            try
            {
                var staffUsername = User.Identity?.Name ?? "Cashier";
                var session = await _logisticsService.CounterCollectQrSessionAsync(token, staffUsername);
                return Ok(session);
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to record counter pickup.", error = ex.Message });
            }
        }

        [HttpPost("settlements/counter-collect")]
        public async Task<IActionResult> CounterCollectPickup([FromBody] CounterCollectRequest request)
        {
            try
            {
                var staffUsername = User.Identity?.Name ?? "Cashier";
                var result = await _logisticsService.CounterCollectPickupAsync(
                    request.OrderId,
                    request.PaymentMethod,
                    staffUsername,
                    request.Amount,
                    request.ReferenceNumber);
                return Ok(new { success = result, message = $"Order #{request.OrderId} placed into staff drawer custody." });
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to collect counter pickup.", error = ex.Message });
            }
        }

        // 6. Owner Verification & Final Settlement (AllowAnonymous for mobile QR scan with Master PIN / Password)
        [HttpPost("settlements/qr-session/{token}/owner-approve")]
        [AllowAnonymous]
        public async Task<IActionResult> OwnerApprove(string token, [FromBody] OwnerApproveRequest? request)
        {
            try
            {
                var isAuthenticated = User.Identity?.IsAuthenticated == true;
                var isOwnerRole = isAuthenticated && User.IsInRole("Owner");
                var currentUsername = User.Identity?.Name;

                var session = await _logisticsService.OwnerApproveQrSessionAsync(token, request, currentUsername, isOwnerRole);
                return Ok(session);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to process owner approval.", error = ex.Message });
            }
        }

        // 7. Direct Store GCash Settlement Bypass
        [HttpPost("settlements/direct-gcash")]
        public async Task<IActionResult> DirectGcashSettlement([FromBody] SettleDirectGcashRequest request)
        {
            try
            {
                var staffUsername = User.Identity?.Name ?? "Cashier";
                var result = await _logisticsService.SettleDirectStoreGcashAsync(
                    request.OrderId,
                    request.Amount,
                    request.ReferenceNumber,
                    staffUsername);
                return Ok(new { success = result, message = $"Order #{request.OrderId} settled via Direct Store GCash." });
            }
            catch (ArgumentException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to settle Direct Store GCash.", error = ex.Message });
            }
        }
    }

    public class AssignRiderRequest
    {
        public string RiderName { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty;
        public List<int> OrderIds { get; set; } = new List<int>();
    }
}