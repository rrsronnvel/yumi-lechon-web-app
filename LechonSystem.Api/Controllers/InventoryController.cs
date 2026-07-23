using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Services;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // This means the URL will be: /api/inventory
public class InventoryController : ControllerBase
{
    private readonly LechonDbContext _context;
    private readonly IInventoryService _inventoryService;

    // Dependency Injection: The server hands the controller our database connection
    public InventoryController(LechonDbContext context, IInventoryService inventoryService)
    {
        _context = context;
        _inventoryService = inventoryService;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.ItemCategories
            .Include(c => c.ProductCookingProfile) // 👈 Tell SQL to grab the clocks!
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                basePrice = c.BasePrice,
                minimumWeightKg = c.MinimumWeightKg,
                maximumWeightKg = c.MaximumWeightKg,
                isActive = c.IsActive,
                // 👇 Safely extract the times, falling back to defaults if brand new
                tahiDurationMinutes = c.ProductCookingProfile != null ? c.ProductCookingProfile.TahiDurationMinutes : 60,
                salangDurationMinutes = c.ProductCookingProfile != null ? c.ProductCookingProfile.SalangDurationMinutes : 180
            })
            .AsNoTracking()
            .ToListAsync();

        return Ok(categories);
    }

    // --- NEW: Expose the Ledger History ---
    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactionLedger()
    {
        // Go ask the service for the full, read-optimized history
        var ledger = await _inventoryService.GetTransactionLedgerAsync();
        return Ok(ledger);
    }

    // --- UPDATED: Handle Manual Adjustments with strict Rules ---
    [HttpPost("transactions")]
    public async Task<IActionResult> LogTransaction([FromBody] LogTransactionRequest request)
    {
        try
        {
            // Pass everything to the service, including the Reason!
            await _inventoryService.LogTransactionAsync(
                request.ItemCategoryId,
                request.Quantity,
                request.TransactionType,
                request.ReferenceId,
                request.Reason
            );
            return Ok(new { message = "Transaction logged successfully." });
        }
        catch (ArgumentException ex)
        {
            // If the Service "Bouncer" throws an error (e.g. missing reason), 
            // catch it and return a 400 Bad Request to the frontend!
            return BadRequest(new { error = ex.Message });
        }
    }



    [HttpGet("balances")]
    public async Task<IActionResult> GetLiveBalances()
    {
        var balances = await _inventoryService.GetLiveBalancesAsync();
        return Ok(balances);
    }
} // End of InventoryController

// --- NEW: The incoming JSON payload structure ---
public class LogTransactionRequest
{
    public int ItemCategoryId { get; set; }
    public int Quantity { get; set; }

    // FIX 1: Rename this from 'Type' to 'TransactionType'
    public TransactionType TransactionType { get; set; }

    public int? ReferenceId { get; set; }
    public string? Reason { get; set; }
}