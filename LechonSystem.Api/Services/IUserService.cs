using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services;

public interface IUserService
{
    Task<List<UserListItemDto>> GetUsersAsync();
    Task<UserListItemDto> CreateUserAsync(CreateUserRequest request, string currentUsername);
    Task UpdatePasswordAsync(int userId, string newPassword);
    Task<UserListItemDto> ToggleUserStatusAsync(int userId, bool isActive, string currentUsername);
}
