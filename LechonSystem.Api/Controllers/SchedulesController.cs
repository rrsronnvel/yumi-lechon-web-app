using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;
using LechonSystem.Api.Common;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Owner,Cashier")]
public class SchedulesController : ControllerBase
{
    private readonly ISchedulingService _schedulingService;

    public SchedulesController(ISchedulingService schedulingService)
    {
        _schedulingService = schedulingService;
    }

    [HttpGet("roster")]
    public async Task<IActionResult> GetDailyRoster([FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? PhilippineTime.Today).Date;
        var roster = await _schedulingService.GetDailyRosterAsync(targetDate);
        return Ok(roster);
    }

    [HttpGet("daily-sheets")]
    public async Task<ActionResult<DailySheetsResponseDto>> GetDailySheetsAsync([FromQuery] DateTime? date = null)
    {
        var dailySheets = await _schedulingService.GetDailySheetsAsync(date);
        return Ok(dailySheets);
    }

    [HttpGet("freebies-prep")]
    [ProducesResponseType(typeof(FreebiesPrepResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<FreebiesPrepResponseDto>> GetFreebiesPrepAsync([FromQuery] DateTime? date = null)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Invalid date parameter. Format must be YYYY-MM-DD." });
        }

        var targetDate = (date ?? PhilippineTime.Today).Date;
        targetDate = PhilippineTime.NormalizeYear(targetDate);

        var result = await _schedulingService.GetFreebiesPrepSheetAsync(targetDate);
        return Ok(result);
    }

    [HttpPost("prep-requests")]
    [ProducesResponseType(typeof(KitchenPrepRequestDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<KitchenPrepRequestDto>> CreateKitchenPrepRequestAsync([FromBody] CreateKitchenPrepRequestDto request)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Request body cannot be null." });
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var normalizedCategory = NormalizePrepCategory(request.Category);
        if (string.IsNullOrWhiteSpace(normalizedCategory))
        {
            return BadRequest(new { message = "Category must be one of: Staff Meryenda, Owner / Family, VIP Gift, Store Buffer." });
        }

        if (string.IsNullOrWhiteSpace(request.RecipientOrLabel))
        {
            return BadRequest(new { message = "Recipient or Label is required." });
        }

        if (request.RecipientOrLabel.Trim().Length > 150)
        {
            return BadRequest(new { message = "Recipient or Label cannot exceed 150 characters." });
        }

        var (items, itemsJson, itemError) = ParseAndValidateItems(request.Items, request.ItemsJson);
        if (!string.IsNullOrEmpty(itemError))
        {
            return BadRequest(new { message = itemError });
        }

        if (request.Remarks != null && request.Remarks.Length > 500)
        {
            return BadRequest(new { message = "Remarks cannot exceed 500 characters." });
        }

        var targetDate = request.TargetDate != default ? request.TargetDate.Date : PhilippineTime.Today;
        targetDate = PhilippineTime.NormalizeYear(targetDate);

        var targetTime = request.TargetTime != default
            ? new DateTime(targetDate.Year, targetDate.Month, targetDate.Day, request.TargetTime.Hour, request.TargetTime.Minute, 0, DateTimeKind.Unspecified)
            : new DateTime(targetDate.Year, targetDate.Month, targetDate.Day, 15, 0, 0, DateTimeKind.Unspecified);

        var resolvedCreatedBy = UserIdentityHelper.ResolveDisplayName(User, request.CreatedBy);

        var sanitizedRequest = new CreateKitchenPrepRequestDto
        {
            TargetDate = targetDate,
            TargetTime = targetTime,
            Category = normalizedCategory,
            RecipientOrLabel = request.RecipientOrLabel.Trim(),
            Items = items,
            ItemsJson = itemsJson,
            Remarks = request.Remarks?.Trim(),
            CreatedBy = resolvedCreatedBy
        };

        var created = await _schedulingService.CreateKitchenPrepRequestAsync(sanitizedRequest, resolvedCreatedBy);
        return Created($"/api/schedules/prep-requests/{created.Id}", created);
    }

    [HttpDelete("prep-requests/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteKitchenPrepRequestAsync(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new { message = "Invalid prep request ID." });
        }

        var deleted = await _schedulingService.DeleteKitchenPrepRequestAsync(id);
        if (!deleted)
        {
            return NotFound(new { message = $"Kitchen prep request with ID {id} was not found." });
        }

        return NoContent();
    }

    [HttpPut("items/{orderItemId}/override")]
    [HttpPut("{orderItemId}/override")]
    public async Task<IActionResult> OverrideSchedule(int orderItemId, [FromBody] OverrideScheduleRequest request)
    {
        if (!User.IsInRole("Owner"))
        {
            return Forbid();
        }

        try
        {
            var updated = await _schedulingService.OverrideScheduleItemAsync(orderItemId, request);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private static string? NormalizePrepCategory(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var trimmed = input.Trim();

        if (trimmed.Contains("Staff Meryenda", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("Staff", StringComparison.OrdinalIgnoreCase))
            return "Staff Meryenda";
        if (trimmed.Contains("Owner", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("Family", StringComparison.OrdinalIgnoreCase))
            return "Owner / Family";
        if (trimmed.Contains("VIP", StringComparison.OrdinalIgnoreCase))
            return "VIP Gift";
        if (trimmed.Contains("Store Buffer", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("Buffer", StringComparison.OrdinalIgnoreCase))
            return "Store Buffer";

        return null;
    }

    private static (Dictionary<string, int> Items, string ItemsJson, string? Error) ParseAndValidateItems(
        Dictionary<string, int>? items, string? itemsJson)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        if (items != null && items.Count > 0)
        {
            foreach (var kvp in items)
            {
                if (kvp.Value < 0) return (result, "{}", "Item quantities cannot be negative.");
                if (kvp.Value > 0) result[kvp.Key.Trim()] = kvp.Value;
            }
        }
        else if (!string.IsNullOrWhiteSpace(itemsJson))
        {
            try
            {
                var parsed = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, int>>(itemsJson);
                if (parsed != null)
                {
                    foreach (var kvp in parsed)
                    {
                        if (kvp.Value < 0) return (result, "{}", "Item quantities cannot be negative.");
                        if (kvp.Value > 0) result[kvp.Key.Trim()] = kvp.Value;
                    }
                }
            }
            catch
            {
                return (result, "{}", "ItemsJson contains invalid JSON format.");
            }
        }

        if (result.Count == 0)
        {
            return (result, "{}", "At least one prep item with quantity greater than 0 must be requested.");
        }

        var serialized = System.Text.Json.JsonSerializer.Serialize(result);
        return (result, serialized, null);
    }
}

