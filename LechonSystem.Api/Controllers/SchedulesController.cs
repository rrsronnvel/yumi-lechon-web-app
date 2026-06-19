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

    [HttpGet("roster")] // This maps to /api/schedules/roster
    public async Task<IActionResult> GetDailyRoster()
    {
        // 1. We will call a service method to get today's items.
        // We will build this method in Step 2!
        var roster = await _schedulingService.GetDailyRosterAsync();
        return Ok(roster);
    }
}