using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace LechonSystem.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _analyticsService;

        public AnalyticsController(IAnalyticsService analyticsService)
        {
            _analyticsService = analyticsService;
        }

        [HttpGet("sales")]
        public async Task<IActionResult> GetSales()
        {
            var salesReport = await _analyticsService.GetDailySalesAsync();
            return Ok(salesReport);
        }

        [HttpGet("delivery-performance")]
        public async Task<IActionResult> GetDeliveryPerformance()
        {
            var performanceReport = await _analyticsService.GetDeliveryPerformanceAsync();
            return Ok(performanceReport);
        }

        [HttpGet("wastage")]
        public async Task<IActionResult> GetWastage()
        {
            var wastageReport = await _analyticsService.GetInventoryWastageAsync();
            return Ok(wastageReport);
        }
    }
}