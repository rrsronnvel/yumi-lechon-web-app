using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/kitchen-capacity")]
[Authorize(Roles = "Owner,Cashier")]
public sealed class KitchenCapacityController(KitchenCapacityService capacity, LechonDbContext context) : ControllerBase
{
    [HttpGet("day")]
    public async Task<ActionResult<KitchenCapacityDay>> Day(
        [FromQuery] DateOnly date, [FromQuery] string? branch, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await capacity.GetDayAsync(date, branch, cancellationToken));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("evaluate")]
    public async Task<ActionResult<KitchenCapacityEvaluation>> Evaluate(
        KitchenCapacityRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await capacity.EvaluateAsync(request, cancellationToken));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("config")]
    [Authorize(Roles = "Owner")]
    public async Task<ActionResult<KitchenCapacityConfig>> Config(CancellationToken cancellationToken)
    {
        var branches = await context.KitchenBranches.AsNoTracking()
            .OrderByDescending(branch => branch.IsDefault).ThenBy(branch => branch.Name).ToListAsync(cancellationToken);
        var batches = await context.KitchenBatchPresets.AsNoTracking()
            .OrderBy(batch => batch.BranchCode).ThenBy(batch => batch.ScheduleType)
            .ThenBy(batch => batch.SortOrder).ThenBy(batch => batch.AnchorTime).ToListAsync(cancellationToken);
        return Ok(new KitchenCapacityConfig(branches, batches));
    }

    [HttpPut("branches/{id:int}")]
    [Authorize(Roles = "Owner")]
    public async Task<ActionResult<KitchenBranch>> UpdateBranch(int id, KitchenBranch input, CancellationToken cancellationToken)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await KitchenCapacitySchema.LockAsync(context);
        var branch = await context.KitchenBranches.FindAsync([id], cancellationToken);
        if (branch is null)
            return NotFound();
        if (!string.Equals(input.Code.Trim(), branch.Code, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "The branch code is fixed." });
        if (input.SafeBelliesPerPit > input.MaxSqueezeBelliesPerPit)
            return BadRequest(new { message = "Safe bellies per pit cannot exceed the squeeze limit." });
        if ((input.IsDefault && !input.IsActive) || (branch.IsDefault && !input.IsDefault))
            return BadRequest(new { message = "Set another active branch as the default before changing this branch's default status." });

        if (input.IsDefault)
        {
            var otherDefaults = await context.KitchenBranches
                .Where(other => other.Id != id && other.IsDefault).ToListAsync(cancellationToken);
            foreach (var other in otherDefaults)
                other.IsDefault = false;
        }
        branch.Name = input.Name.Trim();
        branch.TotalPits = input.TotalPits;
        branch.SafeBelliesPerPit = input.SafeBelliesPerPit;
        branch.MaxSqueezeBelliesPerPit = input.MaxSqueezeBelliesPerPit;
        branch.PostDepartureBufferMinutes = input.PostDepartureBufferMinutes;
        branch.IsActive = input.IsActive;
        branch.IsDefault = input.IsDefault;
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(branch);
    }

    [HttpPut("batches/{id:int}")]
    [Authorize(Roles = "Owner")]
    public Task<ActionResult<KitchenBatchPreset>> UpdateBatch(
        int id, KitchenBatchPreset batch, CancellationToken cancellationToken) => SaveBatch(id, batch, cancellationToken);

    [HttpPost("batches")]
    [Authorize(Roles = "Owner")]
    public Task<ActionResult<KitchenBatchPreset>> AddBatch(
        KitchenBatchPreset batch, CancellationToken cancellationToken) => SaveBatch(null, batch, cancellationToken);

    private async Task<ActionResult<KitchenBatchPreset>> SaveBatch(int? id, KitchenBatchPreset input,
        CancellationToken cancellationToken)
    {
        var branchCode = input.BranchCode.Trim().ToUpperInvariant();
        var batchCode = input.BatchCode.Trim().ToUpperInvariant();
        if (input.ScheduleType is not ("PeakHoliday" or "Weekend"))
            return BadRequest(new { message = "Select PeakHoliday or Weekend as the schedule type." });
        if (input.StartTime < TimeSpan.Zero || input.EndTime >= TimeSpan.FromDays(1)
            || input.StartTime > input.AnchorTime || input.AnchorTime > input.EndTime)
            return BadRequest(new { message = "Enter a valid same-day window that contains the anchor time." });
        if (input.StartTime.Ticks % TimeSpan.TicksPerMinute != 0 || input.EndTime.Ticks % TimeSpan.TicksPerMinute != 0
            || input.AnchorTime.Ticks % TimeSpan.TicksPerMinute != 0)
            return BadRequest(new { message = "Enter batch times to the nearest minute." });

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await KitchenCapacitySchema.LockAsync(context);
        if (!await context.KitchenBranches.AnyAsync(branch => branch.Code == branchCode, cancellationToken))
            return BadRequest(new { message = "Select an existing kitchen branch." });

        var batch = id.HasValue ? await context.KitchenBatchPresets.FindAsync([id.Value], cancellationToken) : new KitchenBatchPreset();
        if (batch is null)
            return NotFound();
        if (id.HasValue && (batch.BranchCode != branchCode || batch.BatchCode != batchCode || batch.ScheduleType != input.ScheduleType))
            return BadRequest(new { message = "The branch, schedule type, and batch code are fixed for an existing batch." });
        if (!id.HasValue && await context.KitchenBatchPresets.AnyAsync(
                other => other.BranchCode == branchCode && other.BatchCode == batchCode, cancellationToken))
            return Conflict(new { message = "This branch already has that batch code." });
        if (input.IsActive && await context.KitchenBatchPresets.AnyAsync(other =>
                other.Id != batch.Id && other.BranchCode == branchCode && other.ScheduleType == input.ScheduleType
                && other.IsActive && other.StartTime <= input.EndTime && other.EndTime >= input.StartTime, cancellationToken))
            return BadRequest(new { message = "Active batch windows cannot overlap." });

        batch.BranchCode = branchCode;
        batch.ScheduleType = input.ScheduleType;
        batch.BatchCode = batchCode;
        batch.Label = input.Label.Trim();
        batch.StartTime = input.StartTime;
        batch.EndTime = input.EndTime;
        batch.AnchorTime = input.AnchorTime;
        batch.MaxPits = input.MaxPits;
        batch.IsActive = input.IsActive;
        batch.SortOrder = input.SortOrder;
        if (!id.HasValue)
            context.KitchenBatchPresets.Add(batch);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return id.HasValue ? Ok(batch) : StatusCode(StatusCodes.Status201Created, batch);
    }

    [HttpDelete("batches/{id:int}")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> DeleteBatch(int id, CancellationToken cancellationToken)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await KitchenCapacitySchema.LockAsync(context);
        var batch = await context.KitchenBatchPresets.FindAsync([id], cancellationToken);
        if (batch is null)
            return NotFound();

        // Keep the preset key for existing orders and keep a retired seed retired across restarts.
        batch.IsActive = false;
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }
}
