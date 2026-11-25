using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

public static class PayrollNov2026QaSeed
{
    private static readonly DateOnly Saturday = new(2026, 11, 28);
    private static readonly TimeOnly ShiftStart = new(6, 0);
    private static readonly TimeOnly ShiftEnd = new(15, 0);
    private static readonly RosterEntry[] Roster =
    [
        new(1, "Jayson", "Leader", 8m, true, true),
        new(2, "Ced", "Assistant", 5m, true, false),
        new(3, "Henry", "Newbie", 3m, true, false),
        new(4, "Nico", "None", 0m, false, true),
        new(5, "Jaynard", "Leader", 8m, true, true),
        new(6, "Gulay", "Assistant", 5m, true, false),
        new(7, "Jr", "Newbie", 3m, true, false),
    ];

    public static async Task SeedAsync(LechonDbContext context, CancellationToken cancellationToken = default)
    {
        var biometricIds = Roster.Select(entry => entry.BiometricUserId).ToArray();
        var employees = await context.Employees.Where(employee => biometricIds.Contains(employee.BiometricUserId))
            .ToDictionaryAsync(employee => employee.BiometricUserId, cancellationToken);
        var existingAttendance = await context.AttendanceDays
            .Where(day => day.WorkDate == Saturday && biometricIds.Contains(day.Employee.BiometricUserId))
            .Select(day => day.EmployeeId)
            .ToHashSetAsync(cancellationToken);

        foreach (var entry in Roster)
        {
            if (!employees.TryGetValue(entry.BiometricUserId, out var employee))
            {
                employee = new Employee { BiometricUserId = entry.BiometricUserId };
                context.Employees.Add(employee);
            }

            // The existing ID 1 profile can already be linked to a live USB import.
            var fillMissingOnly = employee.Id != 0 && entry.BiometricUserId == 1;
            if (!fillMissingOnly || string.IsNullOrWhiteSpace(employee.FullName))
                employee.FullName = entry.Name;
            if (!fillMissingOnly || string.IsNullOrWhiteSpace(employee.Role))
                employee.Role = "Lechonero";
            if (!fillMissingOnly || employee.DailyRate == 0m)
                employee.DailyRate = 600m;
            if (!fillMissingOnly || employee.DefaultShiftStartTime is null)
                employee.DefaultShiftStartTime = ShiftStart;
            if (!fillMissingOnly || employee.IncentiveTier == "None" || string.IsNullOrWhiteSpace(employee.IncentiveTier))
                employee.IncentiveTier = entry.Tier;
            if (!fillMissingOnly || (employee.IncentiveTier == entry.Tier && employee.IncentiveWeight == 0m))
                employee.IncentiveWeight = entry.Weight;
            employee.IsActive = true;
            employee.IsIncentiveEligible = entry.PartihanEligible;
            employee.HasMilestoneBonus = entry.MilestoneEligible;

            if (existingAttendance.Contains(employee.Id))
                continue;

            context.AttendanceDays.Add(new AttendanceDay
            {
                Employee = employee,
                WorkDate = Saturday,
                TimeIn = Saturday.ToDateTime(ShiftStart),
                TimeOut = Saturday.ToDateTime(ShiftEnd),
                ScheduledStartTime = ShiftStart,
                TotalHours = 9m,
                DayCredit = 1m,
                DayType = "Regular",
                ExceptionFlag = "None",
                IsReviewed = true,
                // Keep this synthetic shift available after subsequent USB imports.
                IsManuallyOverridden = true,
                UpdatedBy = "System QA Seed",
            });
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    private sealed record RosterEntry(int BiometricUserId, string Name, string Tier, decimal Weight,
        bool PartihanEligible, bool MilestoneEligible);
}
