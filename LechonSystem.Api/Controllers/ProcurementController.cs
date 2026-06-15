using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.Interfaces;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProcurementController : ControllerBase
    {
        private readonly IProcurementService _procurementService;

        public ProcurementController(IProcurementService procurementService)
        {
            _procurementService = procurementService;
        }

        [HttpGet("alerts")]
        public async Task<IActionResult> GetLowStockAlerts()
        {
            var alerts = await _procurementService.GetLowStockAlertsAsync();
            return Ok(alerts);
        }

        [HttpPost("generate-po")]
        public async Task<IActionResult> GeneratePO([FromBody] GeneratePoRequest request)
        {
            var purchaseOrder = await _procurementService.GenerateDraftPurchaseOrderAsync(request.SupplierName, request.Method);
            
            if (purchaseOrder == null)
            {
                return BadRequest(new { message = "No raw materials are currently short. Inventory levels are fully secure." });
            }

            return Ok(purchaseOrder);
        }
    }

    // A clean, local data container (DTO) to process incoming button clicks smoothly
    public class GeneratePoRequest
    {
        public string SupplierName { get; set; } = string.Empty;
        
        // Inherits our custom Delivery vs Pickup flag rules natively!
        public FulfillmentMethod Method { get; set; } = FulfillmentMethod.SupplierDelivery;
    }
}