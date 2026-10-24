using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services;

public class CustomerService : ICustomerService
{
    private readonly LechonDbContext _context;

    public CustomerService(LechonDbContext context)
    {
        _context = context;
    }

    public static string NormalizePhoneNumber(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;

        var cleaned = phone.Trim()
            .Replace("-", string.Empty)
            .Replace(" ", string.Empty)
            .Replace("(", string.Empty)
            .Replace(")", string.Empty);

        if (cleaned.StartsWith("+63") && cleaned.Length == 13)
        {
            cleaned = "0" + cleaned.Substring(3);
        }

        return cleaned.Length > 20 ? cleaned.Substring(0, 20) : cleaned;
    }

    public async Task<CustomerProfileDto?> LookupCustomerAsync(string? phone, string? fbName)
    {
        var normalizedPhone = NormalizePhoneNumber(phone);
        var digitCount = normalizedPhone.Count(char.IsDigit);
        var trimmedFb = string.IsNullOrWhiteSpace(fbName) ? null : fbName.Trim();
        var rawTrimmedPhone = phone?.Trim() ?? string.Empty;
        var fbLower = trimmedFb?.ToLower();

        if (digitCount < 7 && (string.IsNullOrWhiteSpace(trimmedFb) || trimmedFb.Length < 3))
        {
            return null;
        }

        var activeFrom = DateTime.Today.AddDays(-1);
        var activeTo = DateTime.Today.AddDays(60);
        var activeOrders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.ItemCategory)
            .Where(o => !o.IsCancelled &&
                (o.IsDraft || (o.TargetDeliveryTime >= activeFrom && o.TargetDeliveryTime <= activeTo)) &&
                ((digitCount >= 7 && (o.ContactNumber == normalizedPhone || o.ContactNumber == rawTrimmedPhone)) ||
                 (fbLower != null &&
                    ((o.FacebookName != null && o.FacebookName.ToLower() == fbLower) ||
                     o.CustomerName.ToLower() == fbLower))))
            .OrderBy(o => o.TargetDeliveryTime ?? DateTime.MaxValue)
            .ThenByDescending(o => o.CreatedAt)
            .ToListAsync();

        var activeSummaries = activeOrders.Select(o =>
        {
            var itemParts = o.OrderItems
                .Select(oi => $"{oi.Quantity}x {oi.ItemCategory?.Name ?? "Lechon"}")
                .ToList();
            if (!string.IsNullOrWhiteSpace(o.AddOns)) itemParts.Add(o.AddOns.Trim());

            return new ActiveCustomerOrderSummaryDto
            {
                OrderId = o.Id,
                OrderReference = o.OrderReference,
                TargetDeliveryTime = o.TargetDeliveryTime,
                GrandTotal = o.GrandTotal,
                ItemsSummary = itemParts.Count > 0 ? string.Join(", ", itemParts) : "Lechon Reservation",
                CreatedBy = o.CreatedBy,
                IsDraft = o.IsDraft
            };
        }).ToList();

        CustomerProfile? profile = null;

        // 1. Primary lookup by ContactNumber if phone has at least 7 digits
        if (digitCount >= 7)
        {
            profile = await _context.CustomerProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.ContactNumber == normalizedPhone || c.ContactNumber == rawTrimmedPhone);
        }

        // 2. Fallback lookup by case-insensitive FacebookName
        if (profile == null && !string.IsNullOrWhiteSpace(trimmedFb) && trimmedFb.Length >= 3)
        {
            profile = await _context.CustomerProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(c =>
                    (c.FacebookName != null && c.FacebookName.ToLower() == fbLower) ||
                    c.FullName.ToLower() == fbLower);
        }

        if (profile != null)
        {
            return MapToDto(profile, activeSummaries);
        }

        // 3. Lazy historical fallback from Orders if no CustomerProfile row exists yet
        if (digitCount >= 7 || (!string.IsNullOrWhiteSpace(trimmedFb) && trimmedFb.Length >= 3))
        {
            var historicalOrders = await _context.Orders
                .AsNoTracking()
                .Where(o => !o.IsCancelled && (
                    (digitCount >= 7 && (o.ContactNumber == normalizedPhone || o.ContactNumber == rawTrimmedPhone)) ||
                    (fbLower != null &&
                        ((o.FacebookName != null && o.FacebookName.ToLower() == fbLower) ||
                         o.CustomerName.ToLower() == fbLower))
                ))
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            if (historicalOrders.Count > 0)
            {
                var latest = historicalOrders[0];
                var seedPhone = NormalizePhoneNumber(latest.ContactNumber);
                if (!string.IsNullOrWhiteSpace(seedPhone))
                {
                    var existing = await _context.CustomerProfiles
                        .FirstOrDefaultAsync(c => c.ContactNumber == seedPhone);

                    if (existing != null)
                    {
                        return MapToDto(existing, activeSummaries);
                    }

                    var seededProfile = new CustomerProfile
                    {
                        ContactNumber = seedPhone,
                        FullName = latest.CustomerName,
                        FacebookName = latest.FacebookName,
                        DefaultAddress = latest.DeliveryAddress,
                        DefaultLandmark = latest.Landmark,
                        IsVip = historicalOrders.Any(o => o.IsTrustedCustomer),
                        TotalOrdersCount = historicalOrders.Count,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    try
                    {
                        _context.CustomerProfiles.Add(seededProfile);
                        await _context.SaveChangesAsync();
                        return MapToDto(seededProfile, activeSummaries);
                    }
                    catch
                    {
                        // Return snapshot DTO without failing if concurrent insert occurred
                        return MapToDto(seededProfile, activeSummaries);
                    }
                }

                return new CustomerProfileDto
                {
                    Id = 0,
                    ContactNumber = latest.ContactNumber ?? normalizedPhone,
                    FullName = latest.CustomerName,
                    FacebookName = latest.FacebookName,
                    DefaultAddress = latest.DeliveryAddress,
                    DefaultLandmark = latest.Landmark,
                    IsVip = historicalOrders.Any(o => o.IsTrustedCustomer),
                    TotalOrdersCount = historicalOrders.Count,
                    UpdatedAt = latest.UpdatedAt ?? latest.CreatedAt,
                    ActiveUpcomingOrders = activeSummaries
                };
            }
        }

        if (activeOrders.Count > 0)
        {
            var latest = activeOrders.OrderByDescending(o => o.CreatedAt).First();
            return new CustomerProfileDto
            {
                Id = 0,
                ContactNumber = latest.ContactNumber ?? normalizedPhone,
                FullName = latest.CustomerName,
                FacebookName = latest.FacebookName,
                DefaultAddress = latest.DeliveryAddress,
                DefaultLandmark = latest.Landmark,
                IsVip = activeOrders.Any(o => o.IsTrustedCustomer),
                TotalOrdersCount = activeOrders.Count,
                UpdatedAt = latest.UpdatedAt ?? latest.CreatedAt,
                ActiveUpcomingOrders = activeSummaries
            };
        }

        return null;
    }

    public async Task<CustomerProfileDto?> UpdateCustomerNotesAsync(int id, UpdateCustomerNotesRequest request)
    {
        var profile = await _context.CustomerProfiles.FindAsync(id);
        if (profile == null)
        {
            return null;
        }

        profile.Preferences = string.IsNullOrWhiteSpace(request.Preferences)
            ? null
            : request.Preferences.Trim();

        profile.ComplaintHistory = string.IsNullOrWhiteSpace(request.ComplaintHistory)
            ? null
            : request.ComplaintHistory.Trim();

        if (request.IsVip.HasValue)
        {
            profile.IsVip = request.IsVip.Value;
        }

        profile.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return MapToDto(profile);
    }

    public async Task<CustomerProfileDto> UpsertCustomerNotesByPhoneAsync(
        string phone,
        string customerName,
        string? fbName,
        UpdateCustomerNotesRequest request)
    {
        var normalizedPhone = NormalizePhoneNumber(phone);
        var rawTrimmedPhone = phone.Trim();

        var profile = await _context.CustomerProfiles
            .FirstOrDefaultAsync(c => c.ContactNumber == normalizedPhone || c.ContactNumber == rawTrimmedPhone);

        var resolvedName = !string.IsNullOrWhiteSpace(customerName)
            ? customerName.Trim()
            : (!string.IsNullOrWhiteSpace(request.CustomerName) ? request.CustomerName.Trim() : string.Empty);

        var resolvedFb = !string.IsNullOrWhiteSpace(fbName)
            ? fbName.Trim()
            : (string.IsNullOrWhiteSpace(request.FacebookName) ? null : request.FacebookName.Trim());

        if (profile == null)
        {
            var historicalOrders = await _context.Orders
                .AsNoTracking()
                .Where(o => !o.IsCancelled && (o.ContactNumber == normalizedPhone || o.ContactNumber == rawTrimmedPhone))
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            var latestOrder = historicalOrders.FirstOrDefault();

            profile = new CustomerProfile
            {
                ContactNumber = !string.IsNullOrWhiteSpace(normalizedPhone) ? normalizedPhone : rawTrimmedPhone,
                FullName = !string.IsNullOrWhiteSpace(resolvedName)
                    ? resolvedName
                    : (latestOrder?.CustomerName ?? "Customer"),
                FacebookName = resolvedFb ?? latestOrder?.FacebookName,
                DefaultAddress = latestOrder?.DeliveryAddress,
                DefaultLandmark = latestOrder?.Landmark,
                Preferences = string.IsNullOrWhiteSpace(request.Preferences) ? null : request.Preferences.Trim(),
                ComplaintHistory = string.IsNullOrWhiteSpace(request.ComplaintHistory) ? null : request.ComplaintHistory.Trim(),
                IsVip = request.IsVip ?? historicalOrders.Any(o => o.IsTrustedCustomer),
                TotalOrdersCount = Math.Max(1, historicalOrders.Count),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.CustomerProfiles.Add(profile);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(resolvedName))
            {
                profile.FullName = resolvedName;
            }
            if (!string.IsNullOrWhiteSpace(resolvedFb))
            {
                profile.FacebookName = resolvedFb;
            }

            profile.Preferences = string.IsNullOrWhiteSpace(request.Preferences)
                ? null
                : request.Preferences.Trim();

            profile.ComplaintHistory = string.IsNullOrWhiteSpace(request.ComplaintHistory)
                ? null
                : request.ComplaintHistory.Trim();

            if (request.IsVip.HasValue)
            {
                profile.IsVip = request.IsVip.Value;
            }

            profile.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return MapToDto(profile);
    }

    private static CustomerProfileDto MapToDto(
        CustomerProfile profile,
        List<ActiveCustomerOrderSummaryDto>? activeUpcomingOrders = null)
    {
        return new CustomerProfileDto
        {
            Id = profile.Id,
            ContactNumber = profile.ContactNumber,
            FullName = profile.FullName,
            FacebookName = profile.FacebookName,
            DefaultAddress = profile.DefaultAddress,
            DefaultLandmark = profile.DefaultLandmark,
            Preferences = profile.Preferences,
            ComplaintHistory = profile.ComplaintHistory,
            IsVip = profile.IsVip,
            TotalOrdersCount = profile.TotalOrdersCount,
            UpdatedAt = profile.UpdatedAt,
            ActiveUpcomingOrders = activeUpcomingOrders ?? new()
        };
    }
}
