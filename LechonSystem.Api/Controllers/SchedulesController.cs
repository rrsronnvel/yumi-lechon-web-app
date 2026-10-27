using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;
using LechonSystem.Api.Common;

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
    public async Task<IActionResult> GetDailyRoster([FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? PhilippineTime.Today).Date;
        var roster = await _schedulingService.GetDailyRosterAsync(targetDate);
        return Ok(roster);
    }

    [HttpGet("daily-sheets")]
    public async Task<ActionResult<DailySheetsResponseDto>> GetDailySheetsAsync([FromQuery] DateTime? date = null)
    {
        var dailySheets = await _schedulingService.GetDailySheetsAsync(date);
        return Ok(dailySheets);
    }

    [HttpPut("items/{orderItemId}/override")]
    [HttpPut("{orderItemId}/override")]
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
