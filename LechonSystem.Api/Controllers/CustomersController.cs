using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;

namespace LechonSystem.Api.Controllers;

[Authorize(Roles = "Owner,Cashier")]
[ApiController]
[Route("api/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly ICustomerService _customerService;

    public CustomersController(ICustomerService customerService)
    {
        _customerService = customerService;
    }

    [HttpGet("lookup")]
    public async Task<IActionResult> LookupCustomer([FromQuery] string? phone, [FromQuery] string? fbName)
    {
        var profile = await _customerService.LookupCustomerAsync(phone, fbName);
        return Ok(profile);
    }

    [HttpPut("{id:int}/notes")]
    public async Task<IActionResult> UpdateCustomerNotes(int id, [FromBody] UpdateCustomerNotesRequest request)
    {
        var updated = await _customerService.UpdateCustomerNotesAsync(id, request);
        if (updated == null)
        {
            return NotFound(new { message = $"Customer profile with ID {id} not found." });
        }

        return Ok(updated);
    }

    [HttpPut("by-phone/{phone}/notes")]
    public async Task<IActionResult> UpsertCustomerNotesByPhone(
        string phone,
        [FromQuery] string? customerName,
        [FromQuery] string? fbName,
        [FromBody] UpdateCustomerNotesRequest request)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return BadRequest(new { message = "Phone number is required." });
        }

        var updated = await _customerService.UpsertCustomerNotesByPhoneAsync(
            phone,
            customerName ?? request.CustomerName ?? "Customer",
            fbName ?? request.FacebookName,
            request);

        return Ok(updated);
    }
}
