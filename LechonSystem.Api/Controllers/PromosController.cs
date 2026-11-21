using System.Text.Json;
using System.Text.RegularExpressions;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Controllers;

[ApiController]
[Route("api/promos")]
[Authorize]
public class PromosController : ControllerBase
{
    private static readonly string[] AllowedScopes =
        ["Regular", "DecemberRegular", "DecemberPeak", "AllDates"];

    private readonly LechonDbContext _context;

    public PromosController(LechonDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PromoPackage>>> GetAll(
        CancellationToken cancellationToken)
    {
        var promos = await _context.PromoPackages
            .AsNoTracking()
            .OrderBy(promo => promo.SortOrder)
            .ThenBy(promo => promo.Name)
            .ToListAsync(cancellationToken);

        return Ok(promos);
    }

    [HttpGet("for-date")]
    public async Task<ActionResult<IReadOnlyList<PromoPackage>>> GetForDate(
        [FromQuery] DateOnly date,
        CancellationToken cancellationToken)
    {
        var query = _context.PromoPackages
            .AsNoTracking()
            .Where(promo => promo.IsActive);

        if (date.Month == 12 && (date.Day == 24 || date.Day == 31))
        {
            query = query.Where(promo =>
                promo.SeasonScope == "AllDates" ||
                promo.SeasonScope == "DecemberPeak" ||
                (promo.SeasonScope == "DecemberRegular" && promo.AllowOnPeakDates));
        }
        else if (date.Month == 12)
        {
            query = query.Where(promo =>
                promo.SeasonScope == "AllDates" ||
                promo.SeasonScope == "DecemberRegular");
        }
        else
        {
            query = query.Where(promo =>
                promo.SeasonScope == "AllDates" ||
                promo.SeasonScope == "Regular");
        }

        var promos = await query
            .OrderBy(promo => promo.SortOrder)
            .ThenBy(promo => promo.Name)
            .ToListAsync(cancellationToken);

        return Ok(promos);
    }

    [HttpPost]
    [Authorize(Roles = "Owner")]
    public async Task<ActionResult<PromoPackage>> Create(
        [FromBody] PromoPackage request,
        CancellationToken cancellationToken)
    {
        Normalize(request);
        var validationError = Validate(request);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        if (await _context.PromoPackages.AnyAsync(
                promo => promo.Code == request.Code,
                cancellationToken))
        {
            return Conflict(new { message = $"Promo code '{request.Code}' already exists." });
        }

        var promo = new PromoPackage
        {
            Code = request.Code,
            GroupName = request.GroupName,
            Name = request.Name,
            Description = request.Description,
            SeasonScope = request.SeasonScope,
            DiscountAmount = request.DiscountAmount,
            IncludedItemsJson = request.IncludedItemsJson,
            AllowOnPeakDates = request.AllowOnPeakDates,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder
        };

        _context.PromoPackages.Add(promo);
        await _context.SaveChangesAsync(cancellationToken);
        return Created($"/api/promos/{promo.Id}", promo);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Owner")]
    public async Task<ActionResult<PromoPackage>> Update(
        int id,
        [FromBody] PromoPackage request,
        CancellationToken cancellationToken)
    {
        var promo = await _context.PromoPackages.FindAsync([id], cancellationToken);
        if (promo == null)
        {
            return NotFound();
        }

        Normalize(request);
        var validationError = Validate(request);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        if (await _context.PromoPackages.AnyAsync(
                existing => existing.Id != id && existing.Code == request.Code,
                cancellationToken))
        {
            return Conflict(new { message = $"Promo code '{request.Code}' already exists." });
        }

        promo.Code = request.Code;
        promo.GroupName = request.GroupName;
        promo.Name = request.Name;
        promo.Description = request.Description;
        promo.SeasonScope = request.SeasonScope;
        promo.DiscountAmount = request.DiscountAmount;
        promo.IncludedItemsJson = request.IncludedItemsJson;
        promo.AllowOnPeakDates = request.AllowOnPeakDates;
        promo.IsActive = request.IsActive;
        promo.SortOrder = request.SortOrder;

        await _context.SaveChangesAsync(cancellationToken);
        return Ok(promo);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var promo = await _context.PromoPackages.FindAsync([id], cancellationToken);
        if (promo == null)
        {
            return NotFound();
        }

        _context.PromoPackages.Remove(promo);
        await _context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Normalize(PromoPackage promo)
    {
        promo.Code = (promo.Code ?? string.Empty).Trim().ToUpperInvariant();
        promo.GroupName = (promo.GroupName ?? string.Empty).Trim();
        promo.Name = (promo.Name ?? string.Empty).Trim();
        promo.Description = string.IsNullOrWhiteSpace(promo.Description)
            ? null
            : promo.Description.Trim();
        var requestedScope = (promo.SeasonScope ?? string.Empty).Trim();
        promo.SeasonScope = AllowedScopes.FirstOrDefault(scope =>
            scope.Equals(requestedScope, StringComparison.OrdinalIgnoreCase)) ?? requestedScope;
        promo.IncludedItemsJson = CanonicalizeItems(promo.IncludedItemsJson);
    }

    private static string? Validate(PromoPackage promo)
    {
        if (!Regex.IsMatch(promo.Code, "^[A-Z0-9_-]+$"))
        {
            return "Code must be a non-empty slug containing only letters, numbers, underscores, or hyphens.";
        }

        if (string.IsNullOrWhiteSpace(promo.GroupName) || string.IsNullOrWhiteSpace(promo.Name))
        {
            return "Group name and display name are required.";
        }

        if (!AllowedScopes.Contains(promo.SeasonScope, StringComparer.OrdinalIgnoreCase))
        {
            return $"Season scope must be one of: {string.Join(", ", AllowedScopes)}.";
        }

        if (promo.DiscountAmount < 0)
        {
            return "Discount amount cannot be negative.";
        }

        try
        {
            var items = JsonSerializer.Deserialize<Dictionary<string, int>>(promo.IncludedItemsJson);
            if (items == null || items.Any(item => string.IsNullOrWhiteSpace(item.Key) || item.Value < 0))
            {
                return "Included items must be a JSON object with non-negative integer quantities.";
            }
        }
        catch (JsonException)
        {
            return "Included items must be a valid JSON object with integer quantities.";
        }

        return null;
    }

    private static string CanonicalizeItems(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return "{}";
        }

        try
        {
            var items = JsonSerializer.Deserialize<Dictionary<string, int>>(json);
            return items == null ? json.Trim() : JsonSerializer.Serialize(items);
        }
        catch (JsonException)
        {
            return json.Trim();
        }
    }
}
