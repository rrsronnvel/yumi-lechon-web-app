using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services;

public class UserService : IUserService
{
    private readonly LechonDbContext _context;

    public UserService(LechonDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserListItemDto>> GetUsersAsync()
    {
        return await _context.Users
            .AsNoTracking()
            .OrderBy(u => u.Role == "Owner" ? 0 : 1)
            .ThenBy(u => u.CreatedAt)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                Username = u.Username,
                FullName = u.FullName,
                Role = u.Role,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<UserListItemDto> CreateUserAsync(CreateUserRequest request, string currentUsername)
    {
        if (request == null)
        {
            throw new ArgumentException("Request body cannot be null.");
        }

        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            throw new ArgumentException("Full name is required.");
        }

        var username = request.Username?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(username) || !Regex.IsMatch(username, "^[a-z0-9]{3,}$"))
        {
            throw new ArgumentException("Username must be lowercase alphanumeric and at least 3 characters.");
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
        {
            throw new ArgumentException("Password must be at least 6 characters.");
        }

        var normalizedRole = NormalizeRole(request.Role);

        bool usernameExists = await _context.Users
            .AnyAsync(u => u.Username.ToLower() == username);

        if (usernameExists)
        {
            throw new ArgumentException("Username is already taken.");
        }

        var newUser = new User
        {
            Username = username,
            FullName = request.FullName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = normalizedRole,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return new UserListItemDto
        {
            Id = newUser.Id,
            Username = newUser.Username,
            FullName = newUser.FullName,
            Role = newUser.Role,
            IsActive = newUser.IsActive,
            CreatedAt = newUser.CreatedAt
        };
    }

    public async Task<UserListItemDto> UpdateUserAsync(int userId, UpdateUserRequest request, string currentUsername)
    {
        if (request == null) throw new ArgumentException("Request body cannot be null.");
        if (string.IsNullOrWhiteSpace(request.FullName)) throw new ArgumentException("Full name is required.");

        var user = await _context.Users.FirstOrDefaultAsync(candidate => candidate.Id == userId)
            ?? throw new KeyNotFoundException($"User with ID {userId} was not found.");
        var normalizedRole = NormalizeRole(request.Role);

        if (string.Equals(user.Username, currentUsername, StringComparison.OrdinalIgnoreCase) &&
            normalizedRole != "Owner")
        {
            throw new InvalidOperationException("You cannot remove the Owner role from your own account.");
        }

        if (user.Role == "Owner" && normalizedRole != "Owner" && user.IsActive)
        {
            var otherActiveOwners = await _context.Users.CountAsync(candidate =>
                candidate.Id != user.Id && candidate.Role == "Owner" && candidate.IsActive);
            if (otherActiveOwners == 0)
            {
                throw new InvalidOperationException("At least one active Owner account must remain.");
            }
        }

        user.FullName = request.FullName.Trim();
        user.Role = normalizedRole;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new UserListItemDto
        {
            Id = user.Id,
            Username = user.Username,
            FullName = user.FullName,
            Role = user.Role,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }

    public async Task UpdatePasswordAsync(int userId, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
        {
            throw new ArgumentException("Password must be at least 6 characters.");
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new KeyNotFoundException($"User with ID {userId} was not found.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    public async Task<UserListItemDto> ToggleUserStatusAsync(int userId, bool isActive, string currentUsername)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new KeyNotFoundException($"User with ID {userId} was not found.");
        }

        // Self-Preservation Guard
        if (!isActive && string.Equals(user.Username, currentUsername, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("You cannot deactivate your own active Owner account.");
        }

        if (!isActive && user.IsActive && user.Role == "Owner")
        {
            var otherActiveOwners = await _context.Users.CountAsync(candidate =>
                candidate.Id != user.Id && candidate.Role == "Owner" && candidate.IsActive);
            if (otherActiveOwners == 0)
            {
                throw new InvalidOperationException("At least one active Owner account must remain.");
            }
        }

        user.IsActive = isActive;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new UserListItemDto
        {
            Id = user.Id,
            Username = user.Username,
            FullName = user.FullName,
            Role = user.Role,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }

    private static string NormalizeRole(string? role)
    {
        var value = role?.Trim() ?? string.Empty;
        if (string.Equals(value, "Owner", StringComparison.OrdinalIgnoreCase)) return "Owner";
        if (string.Equals(value, "Cashier", StringComparison.OrdinalIgnoreCase)) return "Cashier";
        if (string.Equals(value, "Accountant", StringComparison.OrdinalIgnoreCase)) return "Accountant";
        throw new ArgumentException("Role must be 'Owner', 'Cashier', or 'Accountant'.");
    }
}
