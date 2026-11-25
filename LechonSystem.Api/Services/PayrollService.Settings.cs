using System.Globalization;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed partial class PayrollService
{
    private const string SharedTeam = "SharedTeam";
    private const string QuotaKey = "Payroll_RoastQuota";
    private const string BonusKey = "Payroll_RoastBonusPerExcess";
    private const string BelliesKey = "Payroll_BelliesPerWhole";
    private const string SplitModeKey = "Payroll_IncentiveSplitMode";
    private const string RegularDay = "Regular";
    private const string SpecialHoliday = "SpecialHoliday";
    private const string RegularHoliday = "RegularHoliday";
    private static readonly PayrollSettingsDto DefaultSettings = new(4, 50m, 2);
    private static readonly string[] PolicyKeys = SettingValues(DefaultSettings).Keys.ToArray();

    public async Task<PayrollSettingsDto> GetSettingsAsync(CancellationToken ct)
    {
        var rows = await db.SystemSettings.AsNoTracking().Where(s => PolicyKeys.Contains(s.SettingKey))
            .OrderBy(s => s.Id).ToListAsync(ct);
        var values = rows.GroupBy(s => s.SettingKey).ToDictionary(group => group.Key, group => group.Last().SettingValue);

        T Read<T>(string key, T fallback, Func<T, bool>? valid = null) where T : IParsable<T> =>
            T.TryParse(values.GetValueOrDefault(key), CultureInfo.InvariantCulture, out var result) &&
            (valid is null || valid(result)) ? result : fallback;

        var grace = Read("Payroll_LateGraceMinutes", DefaultSettings.LateGraceMinutes, IsLateMinuteThreshold);
        var tier1End = Math.Max(grace, Read("Payroll_LateTier1MaxMinutes", DefaultSettings.LateTier1MaxMinutes, IsLateMinuteThreshold));
        var tier2End = Math.Max(tier1End, Read("Payroll_LateTier2MaxMinutes", DefaultSettings.LateTier2MaxMinutes, IsLateMinuteThreshold));
        var regularShift = Read("Payroll_RegularShiftTotalHours", DefaultSettings.RegularShiftTotalHours);
        var buffer = Read("Payroll_UnpaidOtBufferHours", DefaultSettings.UnpaidOtBufferHours);
        var minimumOt = Read("Payroll_MinHoursForPaidOt", DefaultSettings.MinHoursForPaidOt);
        if (!IsOvertimeGate(regularShift, buffer, minimumOt))
            (regularShift, buffer, minimumOt) = (DefaultSettings.RegularShiftTotalHours, DefaultSettings.UnpaidOtBufferHours, DefaultSettings.MinHoursForPaidOt);

        return DefaultSettings with
        {
            RoastQuota = Read(QuotaKey, DefaultSettings.RoastQuota, value => value >= 0),
            RoastBonusPerExcess = Read(BonusKey, DefaultSettings.RoastBonusPerExcess, IsMoney),
            BelliesPerWhole = Read(BelliesKey, DefaultSettings.BelliesPerWhole, value => value > 0),
            EnablePartihan = Read("Payroll_EnablePartihan", DefaultSettings.EnablePartihan),
            PartihanRatePerLechon = Read("Payroll_PartihanRatePerLechon", DefaultSettings.PartihanRatePerLechon, IsMoney),
            TiktikDeductionPerLechon = Read("Payroll_TiktikDeductionPerLechon", DefaultSettings.TiktikDeductionPerLechon, IsMoney),
            EnableMilestoneBonus = Read("Payroll_EnableMilestoneBonus", DefaultSettings.EnableMilestoneBonus),
            MilestoneUnitLechons = Read("Payroll_MilestoneUnitLechons", DefaultSettings.MilestoneUnitLechons, value => value > 0),
            MilestoneBonusAmount = Read("Payroll_MilestoneBonusAmount", DefaultSettings.MilestoneBonusAmount, IsMoney),
            StandardWorkHoursPerDay = Read("Payroll_StandardWorkHoursPerDay", DefaultSettings.StandardWorkHoursPerDay, IsStandardWorkHours),
            OvertimeMultiplier = Read("Payroll_OvertimeMultiplier", DefaultSettings.OvertimeMultiplier, IsMultiplier),
            RegularShiftTotalHours = regularShift,
            UnpaidOtBufferHours = buffer,
            MinHoursForPaidOt = minimumOt,
            EnableHolidayPay = Read("Payroll_EnableHolidayPay", DefaultSettings.EnableHolidayPay),
            SpecialHolidayMultiplier = Read("Payroll_SpecialHolidayMultiplier", DefaultSettings.SpecialHolidayMultiplier, IsMultiplier),
            RegularHolidayMultiplier = Read("Payroll_RegularHolidayMultiplier", DefaultSettings.RegularHolidayMultiplier, IsMultiplier),
            EnableLateDeduction = Read("Payroll_EnableLateDeduction", DefaultSettings.EnableLateDeduction),
            LateGraceMinutes = grace,
            LatePenaltyAmount = Read("Payroll_LatePenaltyAmount", DefaultSettings.LatePenaltyAmount, IsMoney),
            LateTier1MaxMinutes = tier1End,
            LateTier1Penalty = Read("Payroll_LateTier1Penalty", DefaultSettings.LateTier1Penalty, IsMoney),
            LateTier2MaxMinutes = tier2End,
            LateTier2Penalty = Read("Payroll_LateTier2Penalty", DefaultSettings.LateTier2Penalty, IsMoney),
            LateTier3Penalty = Read("Payroll_LateTier3Penalty", DefaultSettings.LateTier3Penalty, IsMoney),
            EnableValeSystem = Read("Payroll_EnableValeSystem", DefaultSettings.EnableValeSystem),
            ValeAllowedDayOfWeek = values.TryGetValue("Payroll_ValeAllowedDayOfWeek", out var valeDay) && IsValeDay(valeDay)
                ? valeDay : DefaultSettings.ValeAllowedDayOfWeek,
            EnforceValeEarnedCap = Read("Payroll_EnforceValeEarnedCap", DefaultSettings.EnforceValeEarnedCap),
            AutoDeductValeOnPayroll = Read("Payroll_AutoDeductValeOnPayroll", DefaultSettings.AutoDeductValeOnPayroll),
            SyncToExpensesOnFinalize = Read("Payroll_SyncToExpensesOnFinalize", DefaultSettings.SyncToExpensesOnFinalize),
        };
    }

    public Task<PayrollSettingsDto> SaveSettingsAsync(PayrollSettingsDto input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        if (input.RoastQuota < 0 || input.BelliesPerWhole <= 0 || input.IncentiveSplitMode != SharedTeam)
            throw new ArgumentException("Enter a non-negative quota, at least one belly per whole, and use Shared Team incentive splitting.");
        if (input.MilestoneUnitLechons <= 0)
            throw new ArgumentException("Enter a milestone of at least one lechon.");
        ValidateMoney(input.RoastBonusPerExcess, "Bonus per excess lechon");
        ValidateMoney(input.PartihanRatePerLechon, "Partihan rate per lechon");
        ValidateMoney(input.TiktikDeductionPerLechon, "Tiktik deduction per lechon");
        ValidateMoney(input.MilestoneBonusAmount, "Milestone bonus amount");
        ValidateMoney(input.LatePenaltyAmount, "Late penalty");
        ValidateMoney(input.LateTier1Penalty, "First late penalty");
        ValidateMoney(input.LateTier2Penalty, "Second late penalty");
        ValidateMoney(input.LateTier3Penalty, "Third late penalty");
        if (!IsStandardWorkHours(input.StandardWorkHoursPerDay))
            throw new ArgumentException("Enter standard work hours from 0.01 to 24, with up to two decimal places.");
        if (!IsMultiplier(input.OvertimeMultiplier) || !IsMultiplier(input.SpecialHolidayMultiplier) || !IsMultiplier(input.RegularHolidayMultiplier))
            throw new ArgumentException("Enter overtime and holiday multipliers of at least 1, with up to two decimal places.");
        if (!IsOvertimeGate(input.RegularShiftTotalHours, input.UnpaidOtBufferHours, input.MinHoursForPaidOt))
            throw new ArgumentException("The paid OT threshold must follow the regular shift and unpaid buffer, with at least one hour beyond the regular shift. Use up to two decimal places.");
        if (!IsLateMinuteThreshold(input.LateGraceMinutes) || !IsLateMinuteThreshold(input.LateTier1MaxMinutes) ||
            !IsLateMinuteThreshold(input.LateTier2MaxMinutes) || input.LateGraceMinutes > input.LateTier1MaxMinutes ||
            input.LateTier1MaxMinutes > input.LateTier2MaxMinutes)
            throw new ArgumentException("Enter late minute limits from 0 to 1,439 in order, starting at the grace period.");
        if (!IsValeDay(input.ValeAllowedDayOfWeek))
            throw new ArgumentException("Select Wednesday or Any for the allowed Vale day.");

        var settings = (await db.SystemSettings.Where(s => PolicyKeys.Contains(s.SettingKey)).ToListAsync(ct))
            .ToLookup(s => s.SettingKey);
        var now = DateTime.UtcNow;
        foreach (var (key, value) in SettingValues(input))
        {
            var existing = settings[key];
            if (!existing.Any())
            {
                db.SystemSettings.Add(new SystemSetting
                {
                    SettingKey = key, SettingValue = value, UpdatedBy = actor, UpdatedAt = now,
                });
                continue;
            }

            foreach (var setting in existing.Where(setting => setting.SettingValue != value))
            {
                setting.SettingValue = value;
                setting.UpdatedBy = actor;
                setting.UpdatedAt = now;
            }
        }

        await db.SaveChangesAsync(ct);
        return input;
    }, ct);

    public async Task<IReadOnlyList<PayrollHolidayDto>> GetHolidaysAsync(CancellationToken ct) =>
        await db.PayrollHolidays.AsNoTracking().OrderBy(holiday => holiday.HolidayDate)
            .Select(holiday => new PayrollHolidayDto(holiday.HolidayDate, holiday.Name, holiday.HolidayType, holiday.IsActive))
            .ToListAsync(ct);

    public Task<PayrollHolidayDto> SaveHolidayAsync(PayrollHolidayDto input, CancellationToken ct) => WriteAsync(async () =>
    {
        if (input.HolidayDate == default || input.HolidayType is not (SpecialHoliday or RegularHoliday))
            throw new ArgumentException("Select a holiday date and choose Special Holiday or Regular Holiday.");
        var name = CleanText(input.Name, 120, "Holiday name") ?? throw new ArgumentException("Enter the holiday name.");
        var holiday = await db.PayrollHolidays.SingleOrDefaultAsync(row => row.HolidayDate == input.HolidayDate, ct);
        if (holiday is null)
        {
            holiday = new PayrollHoliday { HolidayDate = input.HolidayDate };
            db.PayrollHolidays.Add(holiday);
        }
        holiday.Name = name;
        holiday.HolidayType = input.HolidayType;
        holiday.IsActive = input.IsActive;

        var settings = await GetSettingsAsync(ct);
        var rows = await AttendanceInRange(input.HolidayDate, input.HolidayDate).Include(day => day.Employee).ToListAsync(ct);
        var dayType = holiday.IsActive ? holiday.HolidayType : RegularDay;
        foreach (var day in rows)
            ApplyAttendancePolicy(day, day.Employee, settings, dayType);

        await db.SaveChangesAsync(ct);
        return input with { Name = name };
    }, ct);

    private Task<Dictionary<DateOnly, string>> LoadHolidayTypesAsync(CancellationToken ct) =>
        db.PayrollHolidays.AsNoTracking().Where(holiday => holiday.IsActive)
            .ToDictionaryAsync(holiday => holiday.HolidayDate, holiday => holiday.HolidayType, ct);

    private static bool IsMoney(decimal value) => value >= 0m && value <= MaximumMoney && decimal.Round(value, 2) == value;
    private static bool IsStandardWorkHours(decimal value) => value >= 0.01m && value <= 24m && IsMoney(value);
    private static bool IsMultiplier(decimal value) => value >= 1m && IsMoney(value);
    private static bool IsLateMinuteThreshold(int value) => value is >= 0 and < 1440;
    private static bool IsValeDay(string value) => value is "Any" or "Wednesday";
    private static bool IsOvertimeGate(decimal regular, decimal buffer, decimal minimum) =>
        IsStandardWorkHours(regular) && IsMoney(buffer) && buffer <= 24m &&
        IsMoney(minimum) && minimum <= 48m && minimum >= regular + 1m && minimum > regular + buffer;

    private static Dictionary<string, string> SettingValues(PayrollSettingsDto input)
    {
        static string Format(IFormattable value) => value.ToString(null, CultureInfo.InvariantCulture);
        static string Flag(bool value) => value ? "true" : "false";

        return new Dictionary<string, string>
        {
            [QuotaKey] = Format(input.RoastQuota),
            [BonusKey] = Format(input.RoastBonusPerExcess),
            [BelliesKey] = Format(input.BelliesPerWhole),
            [SplitModeKey] = SharedTeam,
            ["Payroll_EnablePartihan"] = Flag(input.EnablePartihan),
            ["Payroll_PartihanRatePerLechon"] = Format(input.PartihanRatePerLechon),
            ["Payroll_TiktikDeductionPerLechon"] = Format(input.TiktikDeductionPerLechon),
            ["Payroll_EnableMilestoneBonus"] = Flag(input.EnableMilestoneBonus),
            ["Payroll_MilestoneUnitLechons"] = Format(input.MilestoneUnitLechons),
            ["Payroll_MilestoneBonusAmount"] = Format(input.MilestoneBonusAmount),
            ["Payroll_StandardWorkHoursPerDay"] = Format(input.StandardWorkHoursPerDay),
            ["Payroll_OvertimeMultiplier"] = Format(input.OvertimeMultiplier),
            ["Payroll_RegularShiftTotalHours"] = Format(input.RegularShiftTotalHours),
            ["Payroll_UnpaidOtBufferHours"] = Format(input.UnpaidOtBufferHours),
            ["Payroll_MinHoursForPaidOt"] = Format(input.MinHoursForPaidOt),
            ["Payroll_EnableHolidayPay"] = Flag(input.EnableHolidayPay),
            ["Payroll_SpecialHolidayMultiplier"] = Format(input.SpecialHolidayMultiplier),
            ["Payroll_RegularHolidayMultiplier"] = Format(input.RegularHolidayMultiplier),
            ["Payroll_EnableLateDeduction"] = Flag(input.EnableLateDeduction),
            ["Payroll_LateGraceMinutes"] = Format(input.LateGraceMinutes),
            ["Payroll_LatePenaltyAmount"] = Format(input.LatePenaltyAmount),
            ["Payroll_LateTier1MaxMinutes"] = Format(input.LateTier1MaxMinutes),
            ["Payroll_LateTier1Penalty"] = Format(input.LateTier1Penalty),
            ["Payroll_LateTier2MaxMinutes"] = Format(input.LateTier2MaxMinutes),
            ["Payroll_LateTier2Penalty"] = Format(input.LateTier2Penalty),
            ["Payroll_LateTier3Penalty"] = Format(input.LateTier3Penalty),
            ["Payroll_EnableValeSystem"] = Flag(input.EnableValeSystem),
            ["Payroll_ValeAllowedDayOfWeek"] = input.ValeAllowedDayOfWeek,
            ["Payroll_EnforceValeEarnedCap"] = Flag(input.EnforceValeEarnedCap),
            ["Payroll_AutoDeductValeOnPayroll"] = Flag(input.AutoDeductValeOnPayroll),
            ["Payroll_SyncToExpensesOnFinalize"] = Flag(input.SyncToExpensesOnFinalize),
        };
    }
}
