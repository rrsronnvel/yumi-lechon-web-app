using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services;

public interface ICustomerService
{
    Task<CustomerProfileDto?> LookupCustomerAsync(string? phone, string? fbName);
    Task<CustomerProfileDto?> UpdateCustomerNotesAsync(int id, UpdateCustomerNotesRequest request);
    Task<CustomerProfileDto> UpsertCustomerNotesByPhoneAsync(string phone, string customerName, string? fbName, UpdateCustomerNotesRequest request);
}
