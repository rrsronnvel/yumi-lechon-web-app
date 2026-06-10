using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services;

public interface IRoastingService
{
    Task<string> UpdateProductionStatusAsync(int scheduleId, ProductionStatus nextStatus);
}

public class RoastingService : IRoastingService
{
    private readonly LechonDbContext _context;

    public RoastingService(LechonDbContext context)
    {
        _context = context;
    }

   // Change the interface return type from Task<bool> to Task<string>
public async Task<string> UpdateProductionStatusAsync(int scheduleId, ProductionStatus nextStatus)
{
    var schedule = await _context.OrderItemSchedules.FirstOrDefaultAsync(s => s.Id == scheduleId);
    if (schedule == null) return "NOT_FOUND";

    // 1. Idempotency Check: If already matches, exit with a specific keyword
    if (schedule.CurrentStatus == nextStatus)
    {
        return "ALREADY_IN_STATUS"; 
    }

    // 2. Strict Sequential State Machine Constraints
    bool isValidTransition = nextStatus switch
    {
        ProductionStatus.Prepping => schedule.CurrentStatus == ProductionStatus.Defrosting,
        ProductionStatus.Roasting => schedule.CurrentStatus == ProductionStatus.Prepping,
        ProductionStatus.Packaged => schedule.CurrentStatus == ProductionStatus.Roasting,
        ProductionStatus.ReadyForDelivery => schedule.CurrentStatus == ProductionStatus.Packaged,
        _ => false
    };

    if (!isValidTransition)
    {
        throw new InvalidOperationException($"Illogical step! Cannot skip steps to move from {schedule.CurrentStatus} directly to {nextStatus}.");
    }

    // Apply state changes and record current time
    schedule.CurrentStatus = nextStatus;
    var now = DateTime.UtcNow;

    switch (nextStatus)
    {
        case ProductionStatus.Prepping:
            schedule.ActualPreppingStartTime = now;
            break;
        case ProductionStatus.Roasting:
            schedule.ActualSalangTime = now;
            break;
        case ProductionStatus.Packaged:
            schedule.ActualPackagingTime = now;
            break;
        case ProductionStatus.ReadyForDelivery:
            schedule.ActualReadyForDeliveryTime = now;
            break;
    }

    schedule.UpdatedAt = now;
    await _context.SaveChangesAsync();
    return "TRANSITIONED";
}
}