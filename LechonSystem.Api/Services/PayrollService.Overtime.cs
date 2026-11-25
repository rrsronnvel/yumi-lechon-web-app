using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed partial class PayrollService
{
    public Task<AttendanceDayDto> DecideOvertimeAsync(int id, OvertimeDecisionInput input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        if (input.Decision is not ("Approve" or "Reject" or "Pending"))
            throw new ArgumentException("Select Approve, Reject, or Pending for overtime.");
        if (input.OvertimeHours is { } enteredHours)
            ValidateOvertimeHours(enteredHours);
        if (input.OvertimePayOverride is { } enteredPay)
            ValidateMoney(enteredPay, "Overtime pay");
        if (input.UseCalculatedPay && input.OvertimePayOverride.HasValue)
            throw new ArgumentException("Choose calculated overtime pay or enter a custom amount.");

        var day = await db.AttendanceDays.Include(d => d.Employee).SingleOrDefaultAsync(d => d.Id == id && !d.IsSuperseded, ct)
            ?? throw new KeyNotFoundException("Attendance day not found.");
        var settings = await GetSettingsAsync(ct);
        var calendar = await LoadHolidayTypesAsync(ct);
        var now = DateTime.UtcNow;
        if (input.Decision == "Reject")
        {
            SetOvertimeRequest(day, 0m, null);
            day.OvertimeStatus = AttendanceDay.OvertimeRejected;
        }
        else
        {
            var hasFiledHours = day.OvertimeHours > 0m || day.PendingOvertimePayOverride.HasValue || day.OvertimeStatus == AttendanceDay.OvertimeApproved;
            var hours = input.OvertimeHours ?? (hasFiledHours ? day.OvertimeHours : SuggestedOvertime(day, settings));
            var payOverride = input.OvertimePayOverride;
            if (input.Decision == "Approve" && !input.UseCalculatedPay)
                payOverride ??= day.PendingOvertimePayOverride ?? (day.IsOvertimePayOverridden ? day.OvertimePay : null);
            if (hours == 0m && !payOverride.HasValue)
                throw new ArgumentException("Enter overtime hours or a custom overtime amount.");

            SetOvertimeRequest(day, hours, payOverride);
            if (input.Decision == "Approve")
            {
                day.OvertimeStatus = AttendanceDay.OvertimeApproved;
                day.OvertimeApprovedBy = actor.Length <= 120 ? actor : actor[..120];
                day.OvertimeApprovedAt = now;
                day.IsOvertimePayOverridden = payOverride.HasValue;
                day.OvertimePay = payOverride ?? 0m;
                day.PendingOvertimePayOverride = null;
            }
        }

        ApplyAttendancePolicy(day, day.Employee, settings, calendar.GetValueOrDefault(day.WorkDate, RegularDay));
        ValidateMoney(day.OvertimePay, "Overtime pay");
        day.UpdatedBy = actor;
        day.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return AttendanceDto(day);
    }, ct);

    private static void FileOvertimeFromAttendanceEdit(AttendanceDay day, AttendanceInput input)
    {
        // Phase 2 clients may still send numeric fields with an ordinary attendance edit.
        // A changed amount files a request. The owner decision is what authorizes payment.
        var hours = input.OvertimeHours ?? day.OvertimeHours;
        var priorOverride = day.IsOvertimePayOverridden ? day.OvertimePay : day.PendingOvertimePayOverride;
        var payOverride = input.IsOvertimePayOverridden switch
        {
            true => input.OvertimePay ?? priorOverride,
            false => null,
            _ when input.OvertimePay is { } pay && pay != day.OvertimePay && (pay > 0m || priorOverride.HasValue) => pay,
            _ => priorOverride,
        };
        if (hours != day.OvertimeHours || payOverride != priorOverride)
            SetOvertimeRequest(day, hours, payOverride);
    }

    private static void SetOvertimeRequest(AttendanceDay day, decimal hours, decimal? payOverride)
    {
        day.OvertimeStatus = AttendanceDay.OvertimePending;
        day.OvertimeHours = hours;
        day.PendingOvertimePayOverride = payOverride;
        day.OvertimePay = 0m;
        day.IsOvertimePayOverridden = false;
        day.OvertimeApprovedBy = null;
        day.OvertimeApprovedAt = null;
    }

    private static void ApplyOvertimePolicy(AttendanceDay day, decimal dailyRate, PayrollSettingsDto settings)
    {
        day.SuggestedOvertimeHours = SuggestedOvertime(day, settings);
        if (day.OvertimeStatus == AttendanceDay.OvertimeApproved)
        {
            if (!day.IsOvertimePayOverridden)
                day.OvertimePay = Math.Round(dailyRate / settings.StandardWorkHoursPerDay * settings.OvertimeMultiplier * day.OvertimeHours, 2);
            return;
        }

        day.OvertimePay = 0m;
        if (day.OvertimeStatus != AttendanceDay.OvertimeRejected)
        {
            var hasRequest = day.OvertimeHours > 0m || day.PendingOvertimePayOverride.HasValue;
            day.OvertimeStatus = day.SuggestedOvertimeHours > 0m || hasRequest
                ? AttendanceDay.OvertimePending : AttendanceDay.NoOvertime;
        }
    }

    private static decimal SuggestedOvertime(AttendanceDay day, PayrollSettingsDto settings)
    {
        var span = day.TimeIn is { } start && day.TimeOut is { } end
            ? (end - start).Ticks / (decimal)TimeSpan.TicksPerHour : day.TotalHours;
        return span >= settings.MinHoursForPaidOt ? Math.Floor(span - settings.RegularShiftTotalHours) : 0m;
    }

    private static void ValidateOvertimeHours(decimal hours)
    {
        if (hours is < 0m or > 999.99m || Math.Round(hours, 2) != hours)
            throw new ArgumentException("Enter overtime hours from 0 to 999.99, with up to two decimal places.");
    }
}
