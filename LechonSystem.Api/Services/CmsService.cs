using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services
{
    public class CmsService : ICmsService
    {
        private readonly LechonDbContext _context;
        private readonly ISchedulingService _schedulingService;
        private readonly Microsoft.AspNetCore.Http.IHttpContextAccessor _httpContextAccessor;

        private string CurrentUser => _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "System";

        public CmsService(
            LechonDbContext context,
            ISchedulingService schedulingService,
            Microsoft.AspNetCore.Http.IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _schedulingService = schedulingService;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<bool> UpdateCategoryPriceAsync(int categoryId, decimal newPrice, string adminName)
        {
            // 1. Find the specific Lechon category in the database
            var category = await _context.ItemCategories.FindAsync(categoryId);
            if (category == null) return false;

            // 2. Safety Check: If the price didn't actually change, skip the work!
            if (category.BasePrice == newPrice) return true;

            string changedBy = !string.IsNullOrWhiteSpace(_httpContextAccessor.HttpContext?.User?.Identity?.Name)
                ? CurrentUser
                : (!string.IsNullOrWhiteSpace(adminName) && adminName != "Admin" ? adminName : CurrentUser);

            // 3. Create the Paper Trail (The Ledger Entry)
            var historyLog = new PriceHistoryLog
            {
                ItemCategoryId = categoryId,
                OldPrice = category.BasePrice,  // Capture the old price before we overwrite it!
                NewPrice = newPrice,
                ChangedBy = changedBy,
                DateChanged = DateTime.UtcNow
            };

            // 4. Overwrite the actual Menu Price
            category.BasePrice = newPrice;

            // 5. 🚀 THE ATOMIC SAVE
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
            var profile = await _context.ProductCookingProfiles.FirstOrDefaultAsync(p => p.ItemCategoryId == categoryId);

            // Safety Net: If a clock doesn't exist yet, create one!
            if (profile == null)
            {
                profile = new ProductCookingProfile
                {
                    ItemCategoryId = categoryId,
                    PackagingDurationMinutes = 30 // Explicitly default to 30 minutes!
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
                .Where(i => i.ItemCategoryId == profile!.ItemCategoryId
                         && i.Order != null
                         && !i.Order.IsDraft
                         && i.Order.TargetDeliveryTime != null
                         && i.Order.TargetDeliveryTime.Value > DateTime.UtcNow
                         && !i.Order.IsCancelled)
                .ToListAsync();

            // 4. Force a recalculation for each affected item using the injected engine
            foreach (var item in upcomingItems)
            {
                if (item.Order != null)
                {
                    if (item.OrderItemSchedule != null && item.OrderItemSchedule.IsManualOverride)
                        continue;

                    var recalc = await _schedulingService.CalculateScheduleAsync(
                        item.Id,
                        item.Order.TargetDeliveryTime!.Value,
                        item.ItemCategoryId,
                        item.Order.RiderDepartureTime);

                    if (item.OrderItemSchedule != null)
                    {
                        item.OrderItemSchedule.PackagingStartTime = recalc.PackagingStartTime;
                        item.OrderItemSchedule.SalangStartTime = recalc.SalangStartTime;
                        item.OrderItemSchedule.TahiStartTime = recalc.TahiStartTime;
                        item.OrderItemSchedule.TargetDeliveryTime = recalc.TargetDeliveryTime;
                    }
                    else
                    {
                        _context.OrderItemSchedules.Add(recalc);
                    }
                }
            }

            // 5. THE ATOMIC SAVE 🚀
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> ToggleCategoryActiveAsync(int categoryId)
        {
            var category = await _context.ItemCategories.FindAsync(categoryId);
            if (category == null) return false;

            category.IsActive = !category.IsActive;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<List<PriceHistoryLogDto>> GetPriceHistoryAsync(int categoryId)
        {
            return await _context.PriceHistoryLogs
                .AsNoTracking()
                .Where(p => p.ItemCategoryId == categoryId)
                .OrderByDescending(p => p.DateChanged)
                .Select(p => new PriceHistoryLogDto
                {
                    Id = p.Id,
                    ItemCategoryId = p.ItemCategoryId,
                    OldPrice = p.OldPrice,
                    NewPrice = p.NewPrice,
                    ChangedBy = p.ChangedBy,
                    DateChanged = p.DateChanged
                })
                .ToListAsync();
        }

        public async Task<bool> UpdateCategoryDetailsAsync(int categoryId, CategoryMetadataDto dto)
        {
            var category = await _context.ItemCategories.FindAsync(categoryId);
            if (category == null)
            {
                throw new KeyNotFoundException($"Item Category with ID {categoryId} was not found.");
            }

            if (string.IsNullOrWhiteSpace(dto.Name))
            {
                throw new ArgumentException("Category name is required.");
            }

            if (category.MinimumWeightKg == 0)
            {
                // Non-meat Add-On: Force non-meat exclusion shield
                dto.MinimumWeightKg = 0;
                dto.MaximumWeightKg = 0;
                dto.MinimumSafetyStock = 0;
            }
            else
            {
                // Meat roast
                if (dto.MinimumWeightKg < 0)
                {
                    throw new ArgumentException("Minimum weight cannot be negative.");
                }

                if (dto.MinimumWeightKg >= dto.MaximumWeightKg)
                {
                    throw new ArgumentException("Minimum weight must be strictly less than maximum weight.");
                }
            }

            if (dto.MinimumSafetyStock < 0)
            {
                throw new ArgumentException("Minimum safety stock must be non-negative.");
            }

            category.Name = dto.Name.Trim();
            category.MinimumWeightKg = dto.MinimumWeightKg;
            category.MaximumWeightKg = dto.MaximumWeightKg;
            category.MinimumSafetyStock = dto.MinimumSafetyStock;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ToggleCategoryStatusAsync(int categoryId)
        {
            var category = await _context.ItemCategories.FindAsync(categoryId);
            if (category == null)
            {
                throw new KeyNotFoundException($"Item Category with ID {categoryId} was not found.");
            }

            category.IsActive = !category.IsActive;
            await _context.SaveChangesAsync();
            return category.IsActive;
        }

        public async Task<DeliveryPricingDto> GetDeliveryPricingAsync()
        {
            var settings = await _context.SystemSettings
                .AsNoTracking()
                .Where(s => s.SettingKey == "DeliveryFeeBaseFare" || s.SettingKey == "DeliveryFeeRatePerKm")
                .ToListAsync();

            decimal baseFare = 100.00m;
            decimal ratePerKm = 15.00m;

            var baseFareRow = settings.FirstOrDefault(s => s.SettingKey == "DeliveryFeeBaseFare");
            if (baseFareRow != null && decimal.TryParse(baseFareRow.SettingValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedBase))
            {
                baseFare = parsedBase;
            }

            var rateRow = settings.FirstOrDefault(s => s.SettingKey == "DeliveryFeeRatePerKm");
            if (rateRow != null && decimal.TryParse(rateRow.SettingValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedRate))
            {
                ratePerKm = parsedRate;
            }

            return new DeliveryPricingDto
            {
                BaseFare = baseFare,
                RatePerKm = ratePerKm
            };
        }

        public async Task<DeliveryPricingDto> UpdateDeliveryPricingAsync(DeliveryPricingDto dto)
        {
            if (dto.BaseFare < 0)
            {
                throw new ArgumentException("Base fare cannot be negative.");
            }

            if (dto.RatePerKm < 0)
            {
                throw new ArgumentException("Rate per KM cannot be negative.");
            }

            var now = DateTime.UtcNow;
            var user = CurrentUser;

            var baseFareSetting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.SettingKey == "DeliveryFeeBaseFare");
            if (baseFareSetting == null)
            {
                baseFareSetting = new SystemSetting
                {
                    SettingKey = "DeliveryFeeBaseFare"
                };
                _context.SystemSettings.Add(baseFareSetting);
            }
            baseFareSetting.SettingValue = dto.BaseFare.ToString("0.00", CultureInfo.InvariantCulture);
            baseFareSetting.UpdatedBy = user;
            baseFareSetting.UpdatedAt = now;

            var ratePerKmSetting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.SettingKey == "DeliveryFeeRatePerKm");
            if (ratePerKmSetting == null)
            {
                ratePerKmSetting = new SystemSetting
                {
                    SettingKey = "DeliveryFeeRatePerKm"
                };
                _context.SystemSettings.Add(ratePerKmSetting);
            }
            ratePerKmSetting.SettingValue = dto.RatePerKm.ToString("0.00", CultureInfo.InvariantCulture);
            ratePerKmSetting.UpdatedBy = user;
            ratePerKmSetting.UpdatedAt = now;

            await _context.SaveChangesAsync();

            return new DeliveryPricingDto
            {
                BaseFare = dto.BaseFare,
                RatePerKm = dto.RatePerKm
            };
        }
    }
}
