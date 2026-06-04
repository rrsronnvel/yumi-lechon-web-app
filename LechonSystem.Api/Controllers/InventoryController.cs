using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // This means the URL will be: /api/inventory
public class InventoryController : ControllerBase
{
    private readonly LechonDbContext _context;

    // Dependency Injection: The server hands the controller our database connection
    public InventoryController(LechonDbContext context)
    {
        _context = context;
    }

    // GET: /api/inventory/categories
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        // Go to the database, grab all ItemCategories, and turn them into a list
        var categories = await _context.ItemCategories.ToListAsync();
        
        return Ok(categories); // Returns a 200 OK status with the JSON data
    }
}