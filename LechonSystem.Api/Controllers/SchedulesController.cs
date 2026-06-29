using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using LechonSystem.Api.Services;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // This maps to /api/schedules
public class SchedulesController : ControllerBase
{
    private readonly ISchedulingService _schedulingService;

    public SchedulesController(ISchedulingService schedulingService)
    {
        _schedulingService = schedulingService;
    }

   [HttpGet("roster")] // This maps to /api/schedules/roster?date=YYYY-MM-DD
    public async Task<IActionResult> GetDailyRoster([FromQuery] string? date)
    {
        // If the frontend didn't send a date, we default to today's date
        var targetDate = string.IsNullOrEmpty(date) ? DateTime.Today : DateTime.Parse(date);

        // We pass the targetDate down into the kitchen (the service)
        var roster = await _schedulingService.GetDailyRosterAsync(targetDate);
        return Ok(roster);
    }
}