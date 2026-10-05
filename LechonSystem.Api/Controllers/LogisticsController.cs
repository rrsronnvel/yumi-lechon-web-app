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
        // Fetches all live delivery orders currently waiting for a rider assignment
        [HttpGet("unassigned")]
        public async Task<IActionResult> GetUnassignedOrders()
        {
            var unassignedOrders = await _logisticsService.GetUnassignedDeliveryOrdersAsync();
            return Ok(unassignedOrders);
        }

        // 2. POST: api/logistics/assign-rider
        // Executes defensive batch validation and assigns a rider to a set of orders
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
                // Catches our kitchen bouncer's rules if food isn't completely Packaged/ReadyForDelivery
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An unexpected error occurred during dispatch allocation.", error = ex.Message });
            }
        }

        // 3. GET: api/logistics/today
        // Fetches all active delivery orders scheduled for today
        [HttpGet("today")]
        public async Task<IActionResult> GetTodayDispatches()
        {
            var todayDispatches = await _logisticsService.GetTodayDispatchesAsync();
            return Ok(todayDispatches);
        }

        // 4. GET: api/logistics/trips/pending-settlement
        // Fetches individual customer drops pending cash reconciliation
        [HttpGet("trips/pending-settlement")]
        public async Task<IActionResult> GetPendingSettlements()
        {
            var pendingDrops = await _logisticsService.GetPendingSettlementDropsAsync();
            return Ok(pendingDrops);
        }

        // 5. GET: api/logistics/settlements/pickups
        // Fetches all store pickups with pending balance to collect
        [HttpGet("settlements/pickups")]
        public async Task<IActionResult> GetPendingPickupSettlements()
        {
            var pickups = await _logisticsService.GetPendingPickupSettlementsAsync();
            return Ok(pickups);
        }

        // 6. GET: api/logistics/settlements/lalamove
        // Fetches active Lalamove courier orders for anti-loss verification gate
        [HttpGet("settlements/lalamove")]
        public async Task<IActionResult> GetPendingLalamoveSettlements()
        {
            var lalamove = await _logisticsService.GetPendingLalamoveSettlementsAsync();
            return Ok(lalamove);
        }

        // 7. POST: api/logistics/settlements/lalamove/{orderId}/release
        // Confirms physical handover to Lalamove courier (guards against unpaid balance)
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
    }

    // Tiny Request Data Container Carrier (DTO)
    public class AssignRiderRequest
    {
        public string RiderName { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty; // e.g., "Motorcycle", "Van"
        public List<int> OrderIds { get; set; } = new List<int>();
    }
}