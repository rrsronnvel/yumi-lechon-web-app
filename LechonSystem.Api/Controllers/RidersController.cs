using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Owner,Cashier")]
public class RidersController : ControllerBase
{
    private readonly LechonDbContext _context;

    public RidersController(LechonDbContext context)
    {
        _context = context;
    }

    // GET /api/riders
    [HttpGet]
    public async Task<IActionResult> GetRiders()
    {
        var riders = await _context.Riders
            .AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.FullName)
            .Select(r => new RiderDto
            {
                Id = r.Id,
                FullName = r.FullName,
                PhoneNumber = r.PhoneNumber,
                IsActive = r.IsActive
            })
            .ToListAsync();

        return Ok(riders);
    }

    // POST /api/riders
    [HttpPost]
    public async Task<IActionResult> CreateRider([FromBody] CreateRiderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            return BadRequest(new { message = "Full name and phone number are required." });
        }

        var rider = new Rider
        {
            FullName = request.FullName.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Riders.Add(rider);
        await _context.SaveChangesAsync();

        var dto = new RiderDto
        {
            Id = rider.Id,
            FullName = rider.FullName,
            PhoneNumber = rider.PhoneNumber,
            IsActive = rider.IsActive
        };

        return StatusCode(201, dto);
    }

    // DELETE /api/riders/{id}
    // DeliveryTrip stores its historical RiderName as text, so removing the
    // registry entry cannot erase or orphan any past delivery assignment.
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> DeleteRider(int id)
    {
        var rider = await _context.Riders.FindAsync(id);
        if (rider == null)
        {
            return NotFound(new { message = "Rider not found." });
        }

        _context.Riders.Remove(rider);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
