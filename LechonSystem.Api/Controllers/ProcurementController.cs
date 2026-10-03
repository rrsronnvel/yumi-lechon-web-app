using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Interfaces;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProcurementController : ControllerBase
    {
        private readonly IProcurementService _procurementService;
        private readonly LechonDbContext _context;

        public ProcurementController(IProcurementService procurementService, LechonDbContext context)
        {
            _procurementService = procurementService;
            _context = context;
        }

        [HttpGet("alerts")]
        public async Task<IActionResult> GetLowStockAlerts()
        {
            var alerts = await _procurementService.GetLowStockAlertsAsync();
            return Ok(alerts);
        }

        [HttpGet("pending-orders")]
        public async Task<ActionResult<IEnumerable<PurchaseOrder>>> GetPendingPurchaseOrders()
        {
            var pendingOrders = await _context.PurchaseOrders
                .Include(po => po.OrderItems)
                    .ThenInclude(i => i.ItemCategory)
                .Where(po => po.Status == POStatus.Submitted)
                .OrderByDescending(po => po.OrderDate)
                .AsNoTracking()
                .ToListAsync();

            return Ok(pendingOrders);
        }

        [HttpPost("{id}/submit")]
        public async Task<IActionResult> SubmitPurchaseOrder(int id)
        {
            var po = await _context.PurchaseOrders.FindAsync(id);
            if (po == null)
            {
                return NotFound(new { message = $"Purchase Order #{id} was not found." });
            }

            po.Status = POStatus.Submitted;
            po.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(po);
        }

        [HttpPost("generate-po")]
        public async Task<IActionResult> GeneratePO([FromBody] GeneratePoRequest request)
        {
            var purchaseOrder = await _procurementService.GenerateDraftPurchaseOrderAsync(request.SupplierName, request.Method);
            
            if (purchaseOrder == null)
            {
                return BadRequest(new { message = "No raw materials are currently short. Inventory levels are fully secure." });
            }

            if (request.AutoSubmit)
            {
                purchaseOrder.Status = POStatus.Submitted;
                await _context.SaveChangesAsync();
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

        public bool AutoSubmit { get; set; } = false;
    }
}