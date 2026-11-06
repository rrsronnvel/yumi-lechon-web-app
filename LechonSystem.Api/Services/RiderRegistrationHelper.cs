using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services;

public static class RiderRegistrationHelper
{
    private static readonly HashSet<string> ReservedKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        "Unassigned", "Store Pickup", "Pickup", "Lalamove", "Lalamove Courier", "Walk-in", "None", "TBD", "-",
        "BDO", "BPI", "Metrobank", "UnionBank", "Landbank", "PNB", "RCBC", "Security Bank", "Chinabank",
        "EastWest", "GCash", "Maya", "Bank", "Bank Transfer"
    };

    public static async Task<Rider?> EnsureRiderRegisteredAsync(LechonDbContext context, string? riderName, string? phoneNumber = null)
    {
        if (string.IsNullOrWhiteSpace(riderName))
            return null;

        var cleanName = riderName.Trim();
        if (ReservedKeywords.Any(keyword =>
                cleanName.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
            return null;

        var existing = await context.Riders.FirstOrDefaultAsync(r => r.FullName.ToLower() == cleanName.ToLower());
        if (existing == null)
        {
            var rider = new Rider
            {
                FullName = cleanName,
                PhoneNumber = phoneNumber?.Trim() ?? string.Empty,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            context.Riders.Add(rider);
            await context.SaveChangesAsync();
            return rider;
        }

        bool modified = false;
        if (!existing.IsActive)
        {
            existing.IsActive = true;
            modified = true;
        }

        if (!string.IsNullOrWhiteSpace(phoneNumber) && string.IsNullOrWhiteSpace(existing.PhoneNumber))
        {
            existing.PhoneNumber = phoneNumber.Trim();
            modified = true;
        }

        if (modified)
        {
            await context.SaveChangesAsync();
        }

        return existing;
    }
}
