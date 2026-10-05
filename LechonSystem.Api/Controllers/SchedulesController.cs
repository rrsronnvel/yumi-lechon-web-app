using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Owner,Cashier")]
public class SchedulesController : ControllerBase
{
    private readonly ISchedulingService _schedulingService;

    public SchedulesController(ISchedulingService schedulingService)
    {
        _schedulingService = schedulingService;
    }

    [HttpGet("roster")]
    public async Task<IActionResult> GetDailyRoster([FromQuery] string? date)
    {
        var targetDate = string.IsNullOrEmpty(date) ? DateTime.Today : DateTime.Parse(date);
        var roster = await _schedulingService.GetDailyRosterAsync(targetDate);
        return Ok(roster);
    }

    [HttpPut("items/{orderItemId}/override")]
    public async Task<IActionResult> OverrideSchedule(int orderItemId, [FromBody] OverrideScheduleRequest request)
    {
        try
        {
            var updated = await _schedulingService.OverrideScheduleItemAsync(orderItemId, request);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}