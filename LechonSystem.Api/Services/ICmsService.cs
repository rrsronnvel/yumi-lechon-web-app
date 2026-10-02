using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services;

public interface ICmsService
{
    Task<bool> UpdateCategoryPriceAsync(int categoryId, decimal newPrice, string adminName);
    Task<ItemCategory> CreateCategoryAsync(CreateCategoryRequest request);
    Task<bool> UpdateCookingProfileAsync(int profileId, int tahiMinutes, int salangMinutes);
    Task<bool> ToggleCategoryActiveAsync(int categoryId);
    Task<List<PriceHistoryLogDto>> GetPriceHistoryAsync(int categoryId);
    Task<bool> UpdateCategoryDetailsAsync(int categoryId, CategoryMetadataDto dto);
    Task<bool> ToggleCategoryStatusAsync(int categoryId);
}
