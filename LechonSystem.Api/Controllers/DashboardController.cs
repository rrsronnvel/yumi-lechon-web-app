using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using LechonSystem.Api.Services;

namespace LechonSystem.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;

        public DashboardController(IDashboardService dashboardService)
        {
            _dashboardService = dashboardService;
        }

        [HttpGet("tasks/pending-confirmations")]
        public async Task<IActionResult> GetPendingConfirmations()
        {
            var tasks = await _dashboardService.GetPendingConfirmationsAsync();
            return Ok(tasks);
        }

        [HttpGet("tasks/delivery-verifications")]
        public async Task<IActionResult> GetDeliveryVerifications()
        {
            var tasks = await _dashboardService.GetDeliveryVerificationsAsync();
            return Ok(tasks);
        }

        [HttpGet("tasks/defrost-roster")]
        public async Task<IActionResult> GetDefrostingRoster()
        {
            var tasks = await _dashboardService.GetDefrostingRosterAsync();
            return Ok(tasks);
        }

        [HttpGet("tasks/renegotiations")]
        public async Task<ActionResult<List<RenegotiationTaskDto>>> GetRenegotiations()
        {
            var tasks = await _dashboardService.GetRenegotiationTasksAsync();
            return Ok(tasks);
        }
    }
}