using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    // 1. The Interface (The Menu)
    public interface ICmsService
    {
        Task<bool> UpdateCategoryPriceAsync(int categoryId, decimal newPrice, string adminName);
    }

    // 2. The Implementation (The Kitchen)
    public class CmsService : ICmsService
    {
        private readonly LechonDbContext _context;

        public CmsService(LechonDbContext context)
        {
            _context = context;
        }

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
    }
}