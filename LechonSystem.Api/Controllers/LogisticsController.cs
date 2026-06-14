using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.Services;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
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
    }

    // Tiny Request Data Container Carrier (DTO)
    public class AssignRiderRequest
    {
        public string RiderName { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty; // e.g., "Motorcycle", "Van"
        public List<int> OrderIds { get; set; } = new List<int>();
    }
}