using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoastingController : ControllerBase
{
    private readonly IRoastingService _roastingService;

    public RoastingController(IRoastingService roastingService)
    {
        _roastingService = roastingService;
    }

    [HttpPatch("items/{id}/status")]
public async Task<IActionResult> UpdateStatus(int id, [FromBody] ProductionStatus nextStatus)
{
    try
    {
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