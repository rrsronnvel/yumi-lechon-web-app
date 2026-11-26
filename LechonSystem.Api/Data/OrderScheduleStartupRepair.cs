using System.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

internal static class OrderScheduleStartupRepair
{
    public static async Task BackfillWholeHeadsAsync(LechonDbContext context, ISchedulingService scheduling)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await KitchenCapacitySchema.LockAsync(context);

        var items = await context.OrderItems
            .Include(item => item.Order)
            .Include(item => item.ItemCategory)
            .Include(item => item.FulfilledItemCategory)
            .Include(item => item.OrderItemSchedules)
            .Where(item => item.Quantity > 0 && item.Order != null && !item.Order.IsCancelled && !item.Order.IsDraft
                && item.ItemCategory != null
                && (item.FulfilledItemCategory != null ? item.FulfilledItemCategory.MinimumWeightKg : item.ItemCategory.MinimumWeightKg) > 0
                && !(item.FulfilledItemCategory != null ? item.FulfilledItemCategory.Name : item.ItemCategory.Name).ToLower().Contains("belly")
                && item.Quantity > item.OrderItemSchedules.Count)
            .ToListAsync();

        foreach (var item in items)
        {
            var original = item.OrderItemSchedules.MinBy(schedule => schedule.UnitIndex);
            if (original == null)
            {
                if (!item.Order!.IsTimeTbd && item.Order.TargetDeliveryTime.HasValue)
                {
                    await scheduling.SynchronizeItemSchedulesAsync(item, item.Order, item.FulfilledItemCategory ?? item.ItemCategory!);
                }
                continue;
            }

            var existingIndexes = item.OrderItemSchedules.Select(schedule => schedule.UnitIndex).ToHashSet();
            foreach (var existing in item.OrderItemSchedules)
            {
                existing.UnitTotal = item.Quantity;
            }

            for (var index = 1; index <= item.Quantity; index++)
            {
                if (existingIndexes.Contains(index)) continue;

                context.OrderItemSchedules.Add(new OrderItemSchedule
                {
                    OrderItem = item,
                    UnitIndex = index,
                    UnitTotal = item.Quantity,
                    TargetDeliveryTime = original.TargetDeliveryTime,
                    TahiStartTime = original.TahiStartTime,
                    SalangStartTime = original.SalangStartTime,
                    PackagingStartTime = original.PackagingStartTime,
                    CustomWeightDisplay = original.CustomWeightDisplay,
                    IsManualOverride = original.IsManualOverride
                });
            }
        }

        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }
}
