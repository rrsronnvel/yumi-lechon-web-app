using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;

namespace LechonSystem.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrdersController : ControllerBase
    {
        private readonly OrderService _orderService;

        // The server automatically hands us the OrderService because we registered it in Program.cs
        public OrdersController(OrderService orderService)
        {
            _orderService = orderService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
        {
            // 1. Pass the secure DTO to the service layer for processing
            var newOrder = await _orderService.CreateOrderAsync(request);

            // 2. Return a 200 OK success response back to the React frontend
            return Ok(newOrder);
        }
    }
}