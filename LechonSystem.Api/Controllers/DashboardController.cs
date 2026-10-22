using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System.Collections.Generic;
using LechonSystem.Api.Services;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Owner,Cashier")]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;
        private readonly IOrderService _orderService;

        public DashboardController(IDashboardService dashboardService, IOrderService orderService)
        {
            _dashboardService = dashboardService;
            _orderService = orderService;
        }

        [HttpGet("pending-confirmations")]
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

        [HttpGet("roster")]
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

        [HttpPatch("tasks/renegotiations/{id}/agree")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> AgreeToPriceHike(int id)
        {
            var success = await _orderService.ApplyNewMenuPricesAsync(id);
            if (!success) return NotFound();
            return Ok(new { message = "Price hike agreed and applied." });
        }

        [HttpPatch("tasks/renegotiations/{id}/waive")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> WaivePriceHike(int id)
        {
            var success = await _orderService.WaivePriceHikeAsync(id);
            if (!success) return NotFound();
            return Ok(new { message = "Price hike waived." });
        }
    }
}
