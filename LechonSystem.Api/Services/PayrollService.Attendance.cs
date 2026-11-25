using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed partial class PayrollService
{
    private const string DoubleTapNote = "Double-tap / <15m span — verify";

    public async Task<AttendanceImportDto> ImportAttendanceAsync(IReadOnlyList<IFormFile> files, string actor, CancellationToken ct)
    {
        if (files.Count is < 1 or > 2)
            throw new ArgumentException("Select one or two Deli Employee Attendance Record .xls files.");

        var exports = new List<(string FileName, DeliAttendanceExport Export)>();
        foreach (var file in files)
        {
            var fileName = Path.GetFileName(file.FileName.Replace('\\', '/'));
            if (file.Length == 0 || fileName.Length > 255 || !Path.GetExtension(fileName).Equals(".xls", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException(DeliAttendanceParser.WrongExportMessage);

            using var stream = file.OpenReadStream();
            exports.Add((fileName, parser.Parse(stream, ct)));
        }

        return await WriteAsync(async () =>
        {
            var punches = exports.SelectMany(input => input.Export.Punches).ToList();
            var ids = punches.Select(punch => punch.BiometricUserId).Distinct().ToArray();
            var employees = await db.Employees.Where(employee => ids.Contains(employee.BiometricUserId)).ToListAsync(ct);
            var mappedIds = employees.Select(employee => employee.BiometricUserId).ToHashSet();
            var insertedIds = new HashSet<int>();
            var seen = new HashSet<(int BiometricUserId, DateTime PunchTime)>();
            if (punches.Count > 0)
            {
                var min = punches.Min(punch => punch.PunchTime);
                var max = punches.Max(punch => punch.PunchTime);
                var stored = await db.RawAttendancePunches.AsNoTracking()
                    .Where(p => ids.Contains(p.BiometricUserId) && p.PunchTime >= min && p.PunchTime <= max)
                    .Select(p => new { p.BiometricUserId, p.PunchTime }).ToListAsync(ct);
                seen.UnionWith(stored.Select(p => (p.BiometricUserId, p.PunchTime)));
            }

            var now = DateTime.UtcNow;
            var batches = new List<BiometricImportBatch>();
            foreach (var (fileName, export) in exports)
            {
                var batch = new BiometricImportBatch
                {
                    FileName = fileName,
                    PeriodStart = export.PeriodStart,
                    PeriodEnd = export.PeriodEnd,
                    UnmappedUserCount = export.Punches.Where(p => !mappedIds.Contains(p.BiometricUserId))
                        .Select(p => p.BiometricUserId).Distinct().Count(),
                    ImportedBy = actor,
                    ImportedAt = now,
                };
                db.BiometricImportBatches.Add(batch);
                batches.Add(batch);
                foreach (var punch in export.Punches)
                {
                    if (!seen.Add((punch.BiometricUserId, punch.PunchTime)))
                    {
                        batch.DuplicatesSkipped++;
                        continue;
                    }

                    db.RawAttendancePunches.Add(new RawAttendancePunch
                    {
                        BiometricUserId = punch.BiometricUserId,
                        BiometricNameSnapshot = punch.BiometricNameSnapshot is { Length: > 120 } name ? name[..120] : punch.BiometricNameSnapshot,
                        PunchTime = punch.PunchTime,
                        ImportBatch = batch,
                    });
                    insertedIds.Add(punch.BiometricUserId);
                    batch.PunchesImported++;
                }
            }

            await db.SaveChangesAsync(ct);
            await RebuildAttendanceAsync(employees.Where(e => insertedIds.Contains(e.BiometricUserId)).ToList(), ct);
            await db.SaveChangesAsync(ct);

            return new AttendanceImportDto(batches.Sum(b => b.PunchesImported), batches.Sum(b => b.DuplicatesSkipped),
                batches.Select(BatchDto).ToList(), UnmappedUsers(punches.Where(p => !mappedIds.Contains(p.BiometricUserId))));
        }, ct);
    }

    public async Task<AttendanceRangeDto> GetAttendanceAsync(DateOnly startDate, DateOnly endDate, CancellationToken ct)
    {
        ValidateRange(startDate, endDate);
        var first = startDate.ToDateTime(TimeOnly.MinValue);
        var exclusiveEnd = endDate.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var settings = await GetSettingsAsync(ct);
        var days = await LoadCalculatedAttendanceAsync(startDate, endDate, settings, ct);
        var unmapped = await db.RawAttendancePunches.AsNoTracking()
            .Where(p => p.PunchTime >= first && p.PunchTime < exclusiveEnd &&
                        !db.Employees.Any(employee => employee.BiometricUserId == p.BiometricUserId))
            .Select(p => new DeliPunch(p.BiometricUserId, p.BiometricNameSnapshot, p.PunchTime)).ToListAsync(ct);
        var recentBatches = await db.BiometricImportBatches.AsNoTracking().OrderByDescending(batch => batch.ImportedAt)
            .ThenByDescending(batch => batch.Id).Take(10).ToListAsync(ct);
        return new AttendanceRangeDto(days.Select(AttendanceDto).ToList(), UnmappedUsers(unmapped),
            recentBatches.Select(BatchDto).ToList());
    }

    public Task<AttendanceDayDto> UpdateAttendanceAsync(int id, AttendanceInput input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        var day = await db.AttendanceDays.Include(d => d.Employee).SingleOrDefaultAsync(d => d.Id == id && !d.IsSuperseded, ct)
            ?? throw new KeyNotFoundException("Attendance day not found.");
        return await SaveAttendanceOverrideAsync(day, input, actor, ct);
    }, ct);

    public Task<AttendanceDayDto> AddAttendanceAsync(ManualAttendanceInput input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        if (input.WorkDate == default)
            throw new ArgumentException("Enter a work date.");

        var employee = await FindEmployeeAsync(input.EmployeeId, ct);
        var day = await db.AttendanceDays.SingleOrDefaultAsync(d => d.EmployeeId == employee.Id && d.WorkDate == input.WorkDate, ct);
        if (day is { IsSuperseded: false })
            throw new PayrollConflictException("This employee already has attendance for that date. Edit the existing row instead.");
        if (day is null)
        {
            day = new AttendanceDay { Employee = employee, WorkDate = input.WorkDate };
            db.AttendanceDays.Add(day);
        }

        return await SaveAttendanceOverrideAsync(day, input.Attendance, actor, ct);
    }, ct);

    private async Task<AttendanceDayDto> SaveAttendanceOverrideAsync(AttendanceDay day, AttendanceInput input, string actor, CancellationToken ct)
    {
        if (input.DayCredit is not (0m or 0.5m or 1m or 1.5m))
            throw new ArgumentException("Select Full, Half, Peak, or Absent for day credit.");
        if (input.OvertimePay is { } enteredPay)
            ValidateMoney(enteredPay, "Overtime pay");
        if (input.OvertimeHours is { } enteredHours)
            ValidateOvertimeHours(enteredHours);
        if (input.DayType is not (null or "Auto" or RegularDay or SpecialHoliday or RegularHoliday))
            throw new ArgumentException("Select Auto, Regular, Special Holiday, or Regular Holiday for the day type.");

        var timeIn = input.TimeIn;
        var timeOut = input.TimeOut;
        if ((timeIn.HasValue && timeIn.Value.Kind != DateTimeKind.Unspecified) ||
            (timeOut.HasValue && timeOut.Value.Kind != DateTimeKind.Unspecified))
            throw new ArgumentException("Enter Philippine local time without a timezone offset.");
        if (timeIn.HasValue && DateOnly.FromDateTime(timeIn.Value) != day.WorkDate)
            throw new ArgumentException("Time in must fall on the work date.");
        if (timeOut.HasValue && (!timeIn.HasValue || timeOut < timeIn ||
            DateOnly.FromDateTime(timeOut.Value).DayNumber - day.WorkDate.DayNumber > 1))
            throw new ArgumentException("Time out must follow time in on the work date or the next day.");

        var settings = await GetSettingsAsync(ct);
        var holidayTypes = await LoadHolidayTypesAsync(ct);
        var pairingChanged = !day.IsManuallyOverridden || day.TimeIn != timeIn || day.TimeOut != timeOut;
        var shift = ClassifyShift(timeIn, timeOut);
        day.TimeIn = shift.TimeIn;
        day.TimeOut = shift.TimeOut;
        day.TotalHours = shift.Hours;
        day.DayCredit = input.DayCredit;
        FileOvertimeFromAttendanceEdit(day, input);
        if (input.UseEmployeeShiftStart == true || ((day.Id == 0 || day.IsSuperseded) && input.UseEmployeeShiftStart is null && input.ScheduledStartTime is null))
            day.ScheduledStartTime = day.Employee.DefaultShiftStartTime;
        else if (input.ScheduledStartTime.HasValue || input.UseEmployeeShiftStart == false)
            day.ScheduledStartTime = input.ScheduledStartTime;
        if (input.DayType is not null)
            day.DayTypeOverride = input.DayType == "Auto" ? null : input.DayType;
        day.IsLateExcused = input.IsLateExcused ?? day.IsLateExcused;
        day.IsOvernightShift = shift.IsOvernight;
        day.ExceptionFlag = shift.ExceptionFlag;
        day.IsReviewed = input.IsReviewed;
        day.IsManuallyOverridden = true;
        day.IsSuperseded = false;
        var notes = CleanText(input.Notes, 1000, "Notes");
        day.Notes = shift.ExceptionFlag != "MissingPunch" && notes == DoubleTapNote ? null : notes;
        day.UpdatedBy = actor;
        day.UpdatedAt = DateTime.UtcNow;
        ApplyAttendancePolicy(day, day.Employee, settings, holidayTypes.GetValueOrDefault(day.WorkDate, RegularDay));
        await db.SaveChangesAsync(ct);

        if (pairingChanged)
        {
            await RebuildAttendanceAsync([day.Employee], ct);
            await db.SaveChangesAsync(ct);
        }

        return AttendanceDto(day);
    }

    private IQueryable<AttendanceDay> AttendanceInRange(DateOnly startDate, DateOnly endDate) =>
        db.AttendanceDays.Where(d => !d.IsSuperseded && d.WorkDate >= startDate && d.WorkDate <= endDate);

    private async Task<List<AttendanceDay>> LoadCalculatedAttendanceAsync(DateOnly startDate, DateOnly endDate,
        PayrollSettingsDto settings, CancellationToken ct)
    {
        var days = await AttendanceInRange(startDate, endDate).AsNoTracking().Include(d => d.Employee)
            .OrderBy(d => d.WorkDate).ThenBy(d => d.Employee.FullName).ThenBy(d => d.EmployeeId).ToListAsync(ct);
        var holidays = await LoadHolidayTypesAsync(ct);
        foreach (var day in days)
            ApplyAttendancePolicy(day, day.Employee, settings, holidays.GetValueOrDefault(day.WorkDate, RegularDay));
        return days;
    }

    private static void ApplyAttendancePolicy(AttendanceDay day, Employee employee, PayrollSettingsDto settings, string calendarDayType)
    {
        ApplyOvertimePolicy(day, employee.DailyRate, settings);

        day.DayType = day.DayTypeOverride ?? calendarDayType;
        var premiumMultiplier = day.DayType switch
        {
            SpecialHoliday => settings.SpecialHolidayMultiplier - 1m,
            RegularHoliday => settings.RegularHolidayMultiplier - 1m,
            _ => 0m,
        };
        day.HolidayPremiumPay = settings.EnableHolidayPay ? Math.Round(employee.DailyRate * day.DayCredit * premiumMultiplier, 2) : 0m;

        // A morning schedule belongs to a daytime shift. Keep signed clock differences for evening schedules.
        day.LateMinutes = settings.EnableLateDeduction && day.TimeIn is { } timeIn && day.ScheduledStartTime is { } scheduled &&
                (!day.IsOvernightShift || scheduled.Hour >= 12)
            ? Math.Max(0, (int)Math.Floor((timeIn.TimeOfDay - scheduled.ToTimeSpan()).TotalMinutes)) : 0;
        day.LateDeduction = day.LateMinutes switch
        {
            _ when day.IsLateExcused || day.LateMinutes <= settings.LateGraceMinutes => 0m,
            _ when day.LateMinutes <= settings.LateTier1MaxMinutes => settings.LateTier1Penalty,
            _ when day.LateMinutes <= settings.LateTier2MaxMinutes => settings.LateTier2Penalty,
            _ => settings.LateTier3Penalty,
        };
    }

    private async Task RebuildAttendanceAsync(IReadOnlyList<Employee> employees, CancellationToken ct)
    {
        if (employees.Count == 0)
            return;

        var biometricIds = employees.Select(employee => employee.BiometricUserId).ToArray();
        var employeeIds = employees.Select(employee => employee.Id).ToArray();
        // Reading the affected employees' timelines includes both sides of month boundaries and keeps
        // successive overnights consistent when a late import changes which morning punches remain.
        var punches = await db.RawAttendancePunches.AsNoTracking().Where(p => biometricIds.Contains(p.BiometricUserId))
            .OrderBy(p => p.PunchTime).Select(p => new { p.BiometricUserId, p.PunchTime }).ToListAsync(ct);
        var punchesByUser = punches.ToLookup(p => p.BiometricUserId, p => p.PunchTime);
        var storedDays = await db.AttendanceDays.Where(d => employeeIds.Contains(d.EmployeeId)).ToListAsync(ct);
        var daysByEmployee = storedDays.ToLookup(d => d.EmployeeId);
        var now = DateTime.UtcNow;
        var settings = await GetSettingsAsync(ct);
        var holidayTypes = await LoadHolidayTypesAsync(ct);

        foreach (var employee in employees)
        {
            var existing = daysByEmployee[employee.Id].ToDictionary(d => d.WorkDate);
            var dailyPunches = punchesByUser[employee.BiometricUserId].GroupBy(DateOnly.FromDateTime)
                .ToDictionary(group => group.Key, group => group.ToList());
            foreach (var date in dailyPunches.Keys.Union(existing.Keys).Order())
            {
                ct.ThrowIfCancellationRequested();
                var day = existing.GetValueOrDefault(date);
                var holidayType = holidayTypes.GetValueOrDefault(date, RegularDay);
                var nextDate = date < DateOnly.MaxValue ? date.AddDays(1) : (DateOnly?)null;
                var tomorrow = nextDate.HasValue ? dailyPunches.GetValueOrDefault(nextDate.Value) : null;
                if (day is { IsManuallyOverridden: true })
                {
                    if (day.IsOvernightShift && day.TimeOut.HasValue)
                        tomorrow?.Remove(day.TimeOut.Value);
                    ApplyAttendancePolicy(day, employee, settings, holidayType);
                    continue;
                }

                var times = dailyPunches.GetValueOrDefault(date);
                if (times is null || times.Count == 0)
                {
                    if (day is { IsSuperseded: false })
                    {
                        day.IsSuperseded = true;
                        day.UpdatedAt = now;
                    }
                    continue;
                }

                // Leave the next day's explicitly saved punches available to its manual entry.
                var nextDay = nextDate.HasValue ? existing.GetValueOrDefault(nextDate.Value) : null;
                var reserved = nextDay is { IsManuallyOverridden: true } && tomorrow is { Count: > 0 } &&
                    (nextDay.TimeIn == tomorrow[0] || nextDay.TimeOut == tomorrow[0]);
                var shift = PairShift(times, reserved ? null : tomorrow);
                if (day is null)
                {
                    day = new AttendanceDay
                    {
                        EmployeeId = employee.Id, WorkDate = date, ScheduledStartTime = employee.DefaultShiftStartTime,
                    };
                    db.AttendanceDays.Add(day);
                }
                else if (!day.IsSuperseded && day.TimeIn == shift.TimeIn && day.TimeOut == shift.TimeOut)
                {
                    ApplyAttendancePolicy(day, employee, settings, holidayType);
                    continue;
                }

                day.TimeIn = shift.TimeIn;
                day.TimeOut = shift.TimeOut;
                day.TotalHours = shift.Hours;
                day.DayCredit = shift.DayCredit;
                day.IsOvernightShift = shift.IsOvernight;
                day.ExceptionFlag = shift.ExceptionFlag;
                day.IsSuperseded = false;
                day.Notes = shift.Notes;
                day.UpdatedAt = now;
                ApplyAttendancePolicy(day, employee, settings, holidayType);
            }
        }
    }

    private static AttendanceShift PairShift(List<DateTime> times, List<DateTime>? tomorrow)
    {
        var last = times[^1];
        if (last.TimeOfDay >= TimeSpan.FromHours(18) && tomorrow is { Count: > 0 })
        {
            var morning = tomorrow[0];
            var duration = (morning - last).TotalHours;
            if (morning.TimeOfDay < TimeSpan.FromHours(11) && duration is >= 2 and <= 16 && HasUnpairedPunch(times))
            {
                tomorrow.RemoveAt(0);
                return ClassifyShift(last, morning);
            }
        }

        return ClassifyShift(times[0], times.Count >= 2 ? last : null);
    }

    private static bool HasUnpairedPunch(List<DateTime> times)
    {
        // Treat scans less than 15 minutes apart as one event. An odd event count leaves
        // an unmatched check-in after earlier complete pairs. A regular evening checkout stays paired.
        var events = 1;
        for (var index = 1; index < times.Count; index++)
            if (times[index] - times[index - 1] >= TimeSpan.FromMinutes(15))
                events++;

        return events % 2 == 1;
    }

    private static AttendanceShift ClassifyShift(DateTime? timeIn, DateTime? timeOut)
    {
        if (!timeIn.HasValue || !timeOut.HasValue)
            return new AttendanceShift(timeIn, timeOut, 0m, 0m, false, "MissingPunch", null);

        var span = timeOut.Value - timeIn.Value;
        var hours = Math.Round((decimal)span.TotalHours, 2);
        var overnight = timeOut.Value.Date > timeIn.Value.Date;
        return span.TotalMinutes switch
        {
            < 15 => new(timeIn, timeOut, hours, 0m, overnight, "MissingPunch", DoubleTapNote),
            < 300 => new(timeIn, timeOut, hours, 1m, overnight, "ShortShift", null),
            > 600 => new(timeIn, timeOut, hours, 1m, overnight, "LongShift", null),
            _ => new(timeIn, timeOut, hours, 1m, overnight, "None", null),
        };
    }

    private sealed record AttendanceShift(DateTime? TimeIn, DateTime? TimeOut, decimal Hours, decimal DayCredit,
        bool IsOvernight, string ExceptionFlag, string? Notes);

    private static List<UnmappedBiometricUserDto> UnmappedUsers(IEnumerable<DeliPunch> punches) =>
        punches.GroupBy(p => p.BiometricUserId).OrderBy(group => group.Key)
            .Select(group => new UnmappedBiometricUserDto(group.Key, group.OrderByDescending(p => p.PunchTime)
                .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p.BiometricNameSnapshot))?.BiometricNameSnapshot,
                group.Select(p => p.PunchTime).Distinct().Count())).ToList();

    private static AttendanceDayDto AttendanceDto(AttendanceDay d) =>
        new(d.Id, d.EmployeeId, d.Employee.FullName, d.WorkDate, d.TimeIn, d.TimeOut, d.TotalHours, d.DayCredit, d.OvertimePay,
            d.IsOvernightShift, d.ExceptionFlag, d.IsReviewed, d.IsManuallyOverridden, d.Notes, d.UpdatedBy,
            d.OvertimeHours, d.DayType, d.DayTypeOverride, d.HolidayPremiumPay, d.ScheduledStartTime, d.LateMinutes,
            d.LateDeduction, d.IsLateExcused, d.IsOvertimePayOverridden, d.Employee.DailyRate, d.SuggestedOvertimeHours,
            d.OvertimeStatus, d.OvertimeApprovedBy, d.OvertimeApprovedAt, d.PendingOvertimePayOverride);

    private static ImportBatchDto BatchDto(BiometricImportBatch batch) =>
        new(batch.Id, batch.FileName, batch.PeriodStart, batch.PeriodEnd, batch.PunchesImported, batch.DuplicatesSkipped,
            batch.UnmappedUserCount, batch.ImportedBy, batch.ImportedAt);
}
