using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;

namespace LechonSystem.Api.Controllers;

// 1. Define the Delivery Box (DTO) to match your React payload
public class UpdateStatusDto 
{
    public string Status { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class RoastingController : ControllerBase
{
    private readonly IRoastingService _roastingService;

    public RoastingController(IRoastingService roastingService)
    {
        _roastingService = roastingService;
    }

    // 2. Tell the Chef to expect the DTO box
    [HttpPatch("items/{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto request)
    {
        try
        {
            // 3. Safely translate the English string word ("Prepping") into our strict C# Enum
            if (!Enum.TryParse<ProductionStatus>(request.Status, true, out var nextStatus))
            {
                return BadRequest(new { message = $"Invalid cooking status: {request.Status}" });
            }

            var result = await _roastingService.UpdateProductionStatusAsync(id, nextStatus);
            
            if (result == "NOT_FOUND") 
                return NotFound(new { message = $"OrderItemSchedule record ID {id} not found." });

            if (result == "ALREADY_IN_STATUS") 
                return Ok(new { message = $"Status is already set to {nextStatus}. No modifications made." });

            return Ok(new { message = $"Kitchen execution status successfully transitioned to: {nextStatus}." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}