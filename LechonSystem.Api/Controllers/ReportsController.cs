using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "Owner")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("analytics")]
    public async Task<IActionResult> GetAnalytics(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? preset = "This Month")
    {
        var report = await _reportService.GetAnalyticsAsync(startDate, endDate, preset);
        return Ok(report);
    }
}
