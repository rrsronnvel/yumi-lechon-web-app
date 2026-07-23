using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services
{
    // 1. The Interface (The Menu)
    public interface ICmsService
    {
        Task<bool> UpdateCategoryPriceAsync(int categoryId, decimal newPrice, string adminName);
        Task<ItemCategory> CreateCategoryAsync(CreateCategoryRequest request);
        Task<bool> UpdateCookingProfileAsync(int profileId, int tahiMinutes, int salangMinutes);
        Task<bool> ToggleCategoryActiveAsync(int categoryId);
    }

    // 2. The Implementation (The Kitchen)
    public class CmsService : ICmsService
    {
        private readonly LechonDbContext _context;
        private readonly ISchedulingService _schedulingService; // 👈 Add the engine

        public CmsService(LechonDbContext context, ISchedulingService schedulingService)
        {
            _context = context;
            _schedulingService = schedulingService; // 👈 Assign it
        }
        // ... your other methods stay exactly the same

        public async Task<bool> UpdateCategoryPriceAsync(int categoryId, decimal newPrice, string adminName)
        {
            // 1. Find the specific Lechon category in the database
            var category = await _context.ItemCategories.FindAsync(categoryId);
            if (category == null) return false;

            // 2. Safety Check: If the price didn't actually change, skip the work!
            if (category.BasePrice == newPrice) return true;

            // 3. Create the Paper Trail (The Ledger Entry)
            var historyLog = new PriceHistoryLog
            {
                ItemCategoryId = categoryId,
                OldPrice = category.BasePrice,  // Capture the old price before we overwrite it!
                NewPrice = newPrice,
                ChangedBy = adminName,
                DateChanged = DateTime.UtcNow
            };

            // 4. Overwrite the actual Menu Price
            category.BasePrice = newPrice;

            // 5. 🚀 THE ATOMIC SAVE
            // Entity Framework will automatically wrap these two actions in a SQL Transaction.
            // If the server crashes halfway through, it rolls back, preventing accounting leaks.
            _context.PriceHistoryLogs.Add(historyLog);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<ItemCategory> CreateCategoryAsync(CreateCategoryRequest request)
        {
            var newCategory = new ItemCategory
            {
                Name = request.Name,
                MinimumWeightKg = request.MinimumWeightKg,
                MaximumWeightKg = request.MaximumWeightKg,
                BasePrice = request.BasePrice,
                MinimumSafetyStock = request.MinimumSafetyStock,
                IsActive = true // Brand new items are automatically visible!
            };

            _context.ItemCategories.Add(newCategory);
            await _context.SaveChangesAsync();

            return newCategory;
        }

        public async Task<bool> UpdateCookingProfileAsync(int categoryId, int tahiMinutes, int salangMinutes)
        {
            // 👇 Change: Search by ItemCategoryId
            var profile = await _context.ProductCookingProfiles.FirstOrDefaultAsync(p => p.ItemCategoryId == categoryId);

            // Safety Net: If a clock doesn't exist yet, create one!
            if (profile == null)
            {
                profile = new ProductCookingProfile
                {
                    ItemCategoryId = categoryId,
                    PackagingDurationMinutes = 30 // 👈 Explicitly default to 30 minutes!
                };
                _context.ProductCookingProfiles.Add(profile);
            }

            profile.TahiDurationMinutes = tahiMinutes;
            profile.SalangDurationMinutes = salangMinutes;

            // 3. 🌊 THE RIPPLE EFFECT
            var upcomingItems = await _context.OrderItems
                .Include(i => i.Order)
                .Include(i => i.ItemCategory)
                .Include(i => i.OrderItemSchedule)
                // 👇 THE FIX: We use the profile's ItemCategoryId to find matching order items!
                .Where(i => i.ItemCategoryId == profile.ItemCategoryId
                         && i.Order.TargetDeliveryTime > DateTime.UtcNow
                         && !i.Order.IsCancelled)
                .ToListAsync();

            // 4. Force a recalculation for each affected item using the injected engine
            foreach (var item in upcomingItems)
            {
                await _schedulingService.CalculateScheduleAsync(item.Id, item.Order.TargetDeliveryTime, item.ItemCategoryId);
            }

            // 5. THE ATOMIC SAVE 🚀
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> ToggleCategoryActiveAsync(int categoryId)
        {
            var category = await _context.ItemCategories.FindAsync(categoryId);
            if (category == null) return false;

            // Flip the switch! If it's true, make it false. If false, make it true.
            category.IsActive = !category.IsActive;
            await _context.SaveChangesAsync();

            return true;
        }
    }
}