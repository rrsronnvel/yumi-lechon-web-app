using LechonSystem.Api.Common;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/expenses")]
[Authorize(Roles = "Owner,Accountant")]
public sealed class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenseService;

    public ExpensesController(IExpenseService expenseService)
    {
        _expenseService = expenseService;
    }

    [HttpGet]
    public async Task<IActionResult> GetExpenses(
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] string? category,
        [FromQuery] string? costType,
        [FromQuery] string? paymentMethod,
        [FromQuery] string? search)
    {
        try
        {
            return Ok(await _expenseService.GetExpensesAsync(year, month, category, costType, paymentMethod, search));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetExpense(int id)
    {
        var record = await _expenseService.GetExpenseAsync(id);
        return record == null ? NotFound() : Ok(record);
    }

    [HttpPost]
    public async Task<IActionResult> CreateExpense([FromBody] UpsertExpenseRequest request)
    {
        try
        {
            var encodedBy = UserIdentityHelper.ResolveDisplayName(User, User.Identity?.Name);
            var created = await _expenseService.CreateExpenseAsync(request, encodedBy);
            return CreatedAtAction(nameof(GetExpense), new { id = created.Id }, created);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateExpense(int id, [FromBody] UpsertExpenseRequest request)
    {
        try
        {
            var encodedBy = UserIdentityHelper.ResolveDisplayName(User, User.Identity?.Name);
            return Ok(await _expenseService.UpdateExpenseAsync(id, request, encodedBy));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteExpense(int id)
    {
        try
        {
            await _expenseService.DeleteExpenseAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(new { message = exception.Message });
        }
    }

    [HttpGet("summary")]
    [HttpGet("/api/reports/expenses-summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int year, [FromQuery] int month)
    {
        try
        {
            // Do not infer visibility from a client parameter. Only the trusted role
            // claim can enable the revenue/profit branch.
            var includeRevenueAndProfit = User.IsInRole("Owner");
            return Ok(await _expenseService.GetSummaryAsync(year, month, includeRevenueAndProfit));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("auto-reclassify")]
    public async Task<IActionResult> AutoReclassify([FromQuery] int year, [FromQuery] int month)
    {
        try
        {
            return Ok(await _expenseService.AutoReclassifyAsync(year, month));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}
