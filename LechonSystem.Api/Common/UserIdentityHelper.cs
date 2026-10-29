using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;

namespace LechonSystem.Api.Common
{
    public static class UserIdentityHelper
    {
        public static string ResolveDisplayName(ClaimsPrincipal? principal, string? fallback = null)
        {
            string? fullName = null;
            string? username = null;

            if (principal?.Identity != null && principal.Identity.IsAuthenticated)
            {
                fullName = principal.FindFirst("fullName")?.Value
                           ?? principal.FindFirst("FullName")?.Value
                           ?? principal.FindFirst(ClaimTypes.GivenName)?.Value;

                username = principal.FindFirst(ClaimTypes.Name)?.Value
                           ?? principal.FindFirst("username")?.Value
                           ?? principal.Identity.Name;
            }

            var cleanFallback = fallback?.Trim();
            if (!string.IsNullOrWhiteSpace(cleanFallback) &&
                !string.Equals(cleanFallback, "owner", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(cleanFallback, "cashier", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(cleanFallback, "admin", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(cleanFallback, "system", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(fullName) && string.IsNullOrWhiteSpace(username))
                {
                    return cleanFallback;
                }
            }

            if (!string.IsNullOrWhiteSpace(fullName) && !string.IsNullOrWhiteSpace(username))
            {
                if (string.Equals(fullName.Trim(), username.Trim(), StringComparison.OrdinalIgnoreCase) &&
                    (string.Equals(username.Trim(), "owner", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(username.Trim(), "cashier", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(username.Trim(), "system", StringComparison.OrdinalIgnoreCase)))
                {
                    return fullName.Trim();
                }
                return $"{fullName.Trim()} (@{username.Trim()})";
            }

            if (!string.IsNullOrWhiteSpace(fullName))
            {
                return fullName.Trim();
            }

            if (!string.IsNullOrWhiteSpace(username))
            {
                return username.Trim();
            }

            if (!string.IsNullOrWhiteSpace(cleanFallback))
            {
                return cleanFallback;
            }

            return "System";
        }

        public static async Task<string> ResolveDisplayNameAsync(
            ClaimsPrincipal? principal,
            LechonDbContext? dbContext,
            string? fallback = null)
        {
            var resolved = ResolveDisplayName(principal, fallback);
            if (resolved != "System" && resolved.Contains("(@"))
            {
                return resolved;
            }

            // If we only have a username or fallback, try to look up FullName in database
            string? candidateUsername = principal?.FindFirst(ClaimTypes.Name)?.Value
                                      ?? principal?.Identity?.Name
                                      ?? fallback?.Trim();

            if (!string.IsNullOrWhiteSpace(candidateUsername) && dbContext != null)
            {
                // If candidateUsername contains "(@username)", extract it
                var match = System.Text.RegularExpressions.Regex.Match(candidateUsername, @"@(\w+)");
                if (match.Success)
                {
                    candidateUsername = match.Groups[1].Value;
                }

                var user = await dbContext.Users.AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Username == candidateUsername);

                if (user != null && !string.IsNullOrWhiteSpace(user.FullName))
                {
                    if (string.Equals(user.FullName.Trim(), user.Username.Trim(), StringComparison.OrdinalIgnoreCase) &&
                        (string.Equals(user.Username.Trim(), "owner", StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(user.Username.Trim(), "cashier", StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(user.Username.Trim(), "system", StringComparison.OrdinalIgnoreCase)))
                    {
                        return user.FullName.Trim();
                    }
                    return $"{user.FullName.Trim()} (@{user.Username.Trim()})";
                }
            }

            return resolved;
        }

        public static string FormatUserLabel(string? fullName, string? username, string? fallback = "System")
        {
            var cleanFull = fullName?.Trim();
            var cleanUser = username?.Trim();

            if (!string.IsNullOrWhiteSpace(cleanFull) && !string.IsNullOrWhiteSpace(cleanUser))
            {
                if (string.Equals(cleanFull, cleanUser, StringComparison.OrdinalIgnoreCase) &&
                    (string.Equals(cleanUser, "owner", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(cleanUser, "cashier", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(cleanUser, "system", StringComparison.OrdinalIgnoreCase)))
                {
                    return cleanFull;
                }
                return $"{cleanFull} (@{cleanUser})";
            }
            if (!string.IsNullOrWhiteSpace(cleanFull)) return cleanFull;
            if (!string.IsNullOrWhiteSpace(cleanUser)) return cleanUser;
            return fallback ?? "System";
        }
    }
}
