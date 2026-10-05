using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;
using LechonSystem.Api.Models.DTOs;

namespace LechonSystem.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Owner,Cashier")]
    public class OrdersController : ControllerBase
    {
        private readonly IOrderService _orderService;
        private readonly IAiIntakeParserService _aiParserService;

        public OrdersController(IOrderService orderService, IAiIntakeParserService aiParserService)
        {
            _orderService = orderService;
            _aiParserService = aiParserService;
        }

        [HttpPost("parse-screenshot")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ParseScreenshot([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "No screenshot file was provided." });

            if (!file.ContentType.StartsWith("image/"))
                return BadRequest(new { Message = "Uploaded file must be a valid image." });

            try
            {
                var draft = await _aiParserService.ParseScreenshotAsync(file);
                return Ok(draft);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Failed to parse booking screenshot.", Details = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
        {
            var newOrder = await _orderService.CreateOrderAsync(request);
            return Ok(newOrder);
        }

        [HttpPatch("{id}/confirm-payment")]
        public async Task<IActionResult> ConfirmPayment(int id)
        {
            var success = await _orderService.ConfirmPaymentAsync(id);

            if (!success)
                return NotFound($"No pending reservation found for Order ID {id}.");

            return Ok(new { Message = "Payment confirmed and inventory locked successfully." });
        }

        [HttpPatch("{id}/confirm-delivery")]
        public async Task<IActionResult> ConfirmDelivery(int id)
        {
            var success = await _orderService.ConfirmDeliveryDetailsAsync(id);

            if (!success)
                return NotFound($"Order ID {id} not found.");

            return Ok(new { Message = "Delivery details officially confirmed." });
        }

        [HttpPatch("{id}/cancel")]
        public async Task<IActionResult> CancelOrder(int id, [FromBody] CancelOrderRequest? request = null)
        {
            var reason = !string.IsNullOrWhiteSpace(request?.Reason)
                ? request.Reason.Trim()
                : "Cancelled by dispatcher";

            var success = await _orderService.CancelOrderAsync(id, reason);

            if (!success)
                return NotFound($"Order ID {id} not found or could not be cancelled.");

            return Ok(new { Message = "Order permanently voided and inventory released back to ledger." });
        }

        [HttpGet("directory")]
        public async Task<IActionResult> GetOrderDirectory([FromQuery] string? searchTerm, [FromQuery] string? filterTab = "upcoming")
        {
            // Hand the URL search words directly to the fast query we just built
            var directory = await _orderService.GetOrderDirectoryAsync(searchTerm, filterTab);

            // Return the flat JSON array with a 200 OK status
            return Ok(directory);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateOrderAsync(int id, [FromBody] UpdateOrderDto request)
        {
            // 1. The Safety Bouncer: Ensure the URL ID matches the Payload ID
            if (id != request.Id)
            {
                return BadRequest("The Order ID in the URL does not match the ID in the payload.");
            }

            try
            {
                // 2. The Hand-off: Pass the validated data back to the OrderService
                await _orderService.UpdateOrderAsync(id, request);

                // 3. The Green Light: Tell the React frontend everything worked perfectly
                return Ok(new { message = "Order successfully updated." });
            }
            catch (KeyNotFoundException ex)
            {
                // If the service can't find the order in the database, return a 404
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                // Catch any other business logic errors
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetOrderById(int id)
        {
            try
            {
                var order = await _orderService.GetOrderDetailsAsync(id);

                if (order == null)
                    return NotFound($"Order {id} not found.");

                return Ok(order);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPatch("{id}/renegotiate/agree")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> AgreeToPriceHike(int id)
        {
            var success = await _orderService.ApplyNewMenuPricesAsync(id);
            if (!success) return NotFound();
            return Ok();
        }

        [HttpPatch("{id}/renegotiate/waive")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> WaivePriceHike(int id)
        {
            var success = await _orderService.WaivePriceHikeAsync(id);
            if (!success) return NotFound();
            return Ok();
        }


        [HttpGet("{id}/audit-logs")]
        [Authorize(Roles = "Owner,Cashier")]
        public async Task<IActionResult> GetAuditLogs(int id)
        {
            var logs = await _orderService.GetOrderAuditLogsAsync(id);
            return Ok(logs);
        }

    }
}