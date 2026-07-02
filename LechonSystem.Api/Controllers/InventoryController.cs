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

    // GET: /api/inventory/categories
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        // Go to the database, grab all ItemCategories, and turn them into a list
        var categories = await _context.ItemCategories.ToListAsync();
        
        return Ok(categories); // Returns a 200 OK status with the JSON data
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
                request.Type, 
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
} // End of InventoryController

// --- NEW: The incoming JSON payload structure ---
public class LogTransactionRequest
{
    public int ItemCategoryId { get; set; }
    public int Quantity { get; set; }
    public TransactionType Type { get; set; }
    public int? ReferenceId { get; set; }
    public string? Reason { get; set; }
}
