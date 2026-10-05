using System.Threading.Tasks;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services;

public interface IAuthService
{
    Task<AuthResponseDto?> LoginAsync(LoginRequest request);
    Task<UserDto?> GetCurrentUserAsync(string username);
}
