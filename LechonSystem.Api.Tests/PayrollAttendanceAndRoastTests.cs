using LechonSystem.Api.DTOs;
using LechonSystem.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Tests;

public class PayrollAttendanceAndRoastTests
{
    private const string Owner = "owner-test";
    private static readonly CancellationToken Ct = CancellationToken.None;
    private static readonly DateOnly December23 = new(2026, 12, 23);

    [Fact]
    public async Task TwoBelliesMakeOneLechonAndThePartihanPoolUsesTierWeights()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var jason = await AddRoasterAsync(payroll, 1, "Jason", "Leader", 6m);
        var ced = await AddRoasterAsync(payroll, 2, "Ced", "Assistant", 5m);
        var henry = await AddRoasterAsync(payroll, 3, "Henry", "Newbie", 4m);
        foreach (var employee in new[] { jason, ced, henry })
            await payroll.AddAttendanceAsync(new(employee.Id, December23, new(null, null, 1m, 0m, true, null)), Owner, Ct);

        var production = Assert.Single(await payroll.SaveRoastProductionAsync([new(December23, 12, 6)], Owner, Ct));
        var byEmployee = production.Allocations.ToDictionary(row => row.EmployeeId);

        Assert.Equal(2, production.BelliesPerWholeSnapshot);
        Assert.Equal(15, production.EquivalentLechons);
        Assert.Equal(750m, production.PartihanPool);
        Assert.Equal(300m, byEmployee[jason.Id].PartihanAmount);
        Assert.Equal(250m, byEmployee[ced.Id].PartihanAmount);
        Assert.Equal(200m, byEmployee[henry.Id].PartihanAmount);
        Assert.Equal(750m, byEmployee.Values.Sum(row => row.PartihanAmount));
        Assert.Equal(3, await store.Db.DailyRoastAllocations.CountAsync(Ct));

        await payroll.SaveRoastAllocationsAsync(December23, new([new(jason.Id, 320m, 15m)]), Owner, Ct);
        var recalculated = Assert.Single(await payroll.SaveRoastProductionAsync([new(December23, 11, 6)], Owner, Ct));
        var manual = Assert.Single(recalculated.Allocations, row => row.EmployeeId == jason.Id);
        Assert.True(manual.IsManualOverride);
        Assert.Equal(335m, manual.TotalIncentiveAmount);

        var draft = await payroll.PreviewPeriodAsync(new(December23, December23), Ct);
        var paid = Assert.Single(draft.Items, row => row.EmployeeId == jason.Id);
        Assert.Equal(320m, paid.PartihanIncentivePay);
        Assert.Equal(15m, paid.MilestoneIncentivePay);
        Assert.Equal(335m, paid.RoastingIncentivePay);

        var reset = await payroll.SaveRoastAllocationsAsync(December23, new([], Reset: true), Owner, Ct);
        Assert.All(reset.Allocations, row => Assert.False(row.IsManualOverride));
        Assert.Equal(280m, Assert.Single(reset.Allocations, row => row.EmployeeId == jason.Id).PartihanAmount);
    }

    [Fact]
    public async Task PartihanRoundingPutsTheRemainingCentavoOnTheHighestWeight()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var settings = await payroll.GetSettingsAsync(Ct);
        await payroll.SaveSettingsAsync(settings with { PartihanRatePerLechon = 0.01m }, Owner, Ct);
        var lead = await AddRoasterAsync(payroll, 1, "Leader", "Leader", 6m);
        var assistant = await AddRoasterAsync(payroll, 2, "Assistant", "Assistant", 5m);
        var newbie = await AddRoasterAsync(payroll, 3, "Newbie", "Newbie", 4m);
        foreach (var employee in new[] { lead, assistant, newbie })
            await payroll.AddAttendanceAsync(new(employee.Id, December23, new(null, null, 1m, 0m, true, null)), Owner, Ct);

        var production = Assert.Single(await payroll.SaveRoastProductionAsync([new(December23, 1, 0)], Owner, Ct));

        var paid = Assert.Single(production.Allocations, row => row.PartihanAmount != 0m);
        Assert.Equal(lead.Id, paid.EmployeeId);
        Assert.Equal(0.01m, paid.PartihanAmount);
        Assert.Equal(production.PartihanPool, production.Allocations.Sum(row => row.PartihanAmount));
    }

    [Fact]
    public async Task ExplicitZeroIncentiveRatesSurviveReloadingTheProductionSnapshot()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var settings = await payroll.GetSettingsAsync(Ct);
        await payroll.SaveSettingsAsync(settings with { PartihanRatePerLechon = 0m, MilestoneBonusAmount = 0m }, Owner, Ct);
        var employee = await AddRoasterAsync(payroll, 1, "Leader", "Leader", 6m, milestone: true);
        await payroll.AddAttendanceAsync(new(employee.Id, December23, new(null, null, 1m, 0m, true, null)), Owner, Ct);
        await payroll.SaveRoastProductionAsync([new(December23, 12, 0)], Owner, Ct);
        store.Db.ChangeTracker.Clear();

        var persisted = Assert.Single(await payroll.GetRoastProductionAsync(December23, December23, Ct));

        Assert.Equal(0m, persisted.PartihanRatePerLechonSnapshot);
        Assert.Equal(0m, persisted.MilestoneBonusAmountSnapshot);
        Assert.Equal(0m, Assert.Single(persisted.Allocations).TotalIncentiveAmount);
    }

    [Theory]
    [InlineData(9, 0)]
    [InlineData(10, 100)]
    [InlineData(20, 200)]
    public async Task EachTenLechonsEarnsABonusOnlyForMarkedRoastersWhoWorked(int equivalents, int bonus)
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var qualifies = await AddRoasterAsync(payroll, 1, "Earned", "Leader", 6m, milestone: true);
        var unmarked = await AddRoasterAsync(payroll, 2, "Unmarked", "Assistant", 5m);
        _ = await AddRoasterAsync(payroll, 3, "Absent", "Newbie", 4m, milestone: true);
        await payroll.AddAttendanceAsync(new(qualifies.Id, December23, new(null, null, 0.5m, 0m, true, null)), Owner, Ct);
        await payroll.AddAttendanceAsync(new(unmarked.Id, December23, new(null, null, 1m, 0m, true, null)), Owner, Ct);

        var production = Assert.Single(await payroll.SaveRoastProductionAsync([new(December23, equivalents, 0)], Owner, Ct));

        Assert.Equal(bonus, production.MilestonePerPerson);
        Assert.Equal(2, production.Allocations.Count);
        Assert.Equal(bonus, Assert.Single(production.Allocations, row => row.EmployeeId == qualifies.Id).MilestoneBonusAmount);
        Assert.Equal(0m, Assert.Single(production.Allocations, row => row.EmployeeId == unmarked.Id).MilestoneBonusAmount);
    }

    [Fact]
    public async Task EnteringTwoOvertimeHoursCalculatesTheConfigured125PercentHourlyRate()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddRoasterAsync(payroll, 1, "Jason", "Leader", 6m);
        var input = new AttendanceInput(December23.ToDateTime(new TimeOnly(6, 0)), December23.ToDateTime(new TimeOnly(16, 0)),
            1m, 0m, true, null, OvertimeHours: 2m);

        var day = await payroll.AddAttendanceAsync(new(employee.Id, December23, input), Owner, Ct);

        Assert.Equal("Pending", day.OvertimeStatus);
        Assert.Equal(0m, day.OvertimePay);
        var approved = await payroll.DecideOvertimeAsync(day.Id, new("Approve"), Owner, Ct);
        Assert.Equal(187.50m, approved.OvertimePay);
        Assert.False(approved.IsOvertimePayOverridden);
        var overridden = await payroll.DecideOvertimeAsync(day.Id, new("Approve", OvertimePayOverride: 200m), Owner, Ct);
        Assert.Equal(200m, overridden.OvertimePay);
        Assert.True(overridden.IsOvertimePayOverridden);
        var automatic = await payroll.DecideOvertimeAsync(day.Id, new("Approve", UseCalculatedPay: true), Owner, Ct);
        Assert.Equal(187.50m, automatic.OvertimePay);
    }

    [Fact]
    public async Task HolidayPayToggleControlsSpecialAndRegularPremiumsUsingTheWorkDate()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddRoasterAsync(payroll, 1, "Jason", "Leader", 6m);
        var eve = December23.AddDays(1);
        var christmas = eve.AddDays(1);
        await payroll.SaveHolidayAsync(new(eve, "Christmas Eve", "SpecialHoliday"), Ct);
        await payroll.SaveHolidayAsync(new(christmas, "Christmas Day", "RegularHoliday"), Ct);
        foreach (var date in new[] { eve, christmas })
            await payroll.AddAttendanceAsync(new(employee.Id, date, new(null, null, 1m, 0m, true, null)), Owner, Ct);

        var off = await payroll.GetAttendanceAsync(eve, christmas, Ct);
        Assert.Equal(new[] { "SpecialHoliday", "RegularHoliday" }, off.Days.Select(row => row.DayType));
        Assert.All(off.Days, row => Assert.Equal(0m, row.HolidayPremiumPay));

        var settings = await payroll.GetSettingsAsync(Ct);
        await payroll.SaveSettingsAsync(settings with { EnableHolidayPay = true }, Owner, Ct);
        var on = await payroll.GetAttendanceAsync(eve, christmas, Ct);
        Assert.Equal(new[] { 180m, 600m }, on.Days.Select(row => row.HolidayPremiumPay));
        var draft = await payroll.PreviewPeriodAsync(new(eve, christmas), Ct);
        Assert.Equal(780m, Assert.Single(draft.Items).HolidayPremiumPay);
    }

    [Fact]
    public async Task LatePenaltyRespectsGraceToggleAndExcuseWithoutWrappingAnEarlyArrival()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddRoasterAsync(payroll, 1, "Jason", "Leader", 6m, shiftStart: new TimeOnly(6, 0));
        var settings = await payroll.GetSettingsAsync(Ct);
        await payroll.SaveSettingsAsync(settings with { EnableLateDeduction = true }, Owner, Ct);

        AttendanceInput Arrives(int hour, int minute, bool excused = false) => new(
            December23.ToDateTime(new TimeOnly(hour, minute)), December23.ToDateTime(new TimeOnly(14, 0)),
            1m, 0m, true, null, IsLateExcused: excused);

        var graceful = await payroll.AddAttendanceAsync(new(employee.Id, December23, Arrives(6, 10)), Owner, Ct);
        Assert.Equal(10, graceful.LateMinutes);
        Assert.Equal(0m, graceful.LateDeduction);
        var late = await payroll.UpdateAttendanceAsync(graceful.Id, Arrives(6, 11), Owner, Ct);
        Assert.Equal(11, late.LateMinutes);
        Assert.Equal(50m, late.LateDeduction);
        var excused = await payroll.UpdateAttendanceAsync(graceful.Id, Arrives(6, 11, excused: true), Owner, Ct);
        Assert.Equal(0m, excused.LateDeduction);
        var early = await payroll.UpdateAttendanceAsync(graceful.Id, Arrives(5, 59), Owner, Ct);
        Assert.Equal(0, early.LateMinutes);
        Assert.Equal(0m, early.LateDeduction);
        await payroll.UpdateAttendanceAsync(graceful.Id, Arrives(6, 11), Owner, Ct);
        await payroll.SaveSettingsAsync(settings, Owner, Ct);
        var disabled = Assert.Single((await payroll.GetAttendanceAsync(December23, December23, Ct)).Days);
        Assert.Equal(0m, disabled.LateDeduction);
    }

    [Fact]
    public async Task OvernightShiftIgnoresMorningDefaultAndHonorsEveningSchedule()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        await AddRoasterAsync(payroll, 1, "Nico", "None", 0m, shiftStart: new TimeOnly(6, 0));
        var settings = await payroll.GetSettingsAsync(Ct);
        await payroll.SaveSettingsAsync(settings with { EnableLateDeduction = true }, Owner, Ct);
        var nextDay = December23.AddDays(1);
        using var raw = DeliBiff8Fixture.Create(December23, nextDay, [(23, "21:00"), (24, "06:00")]);
        await payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(raw)], Owner, Ct);

        var day = Assert.Single((await payroll.GetAttendanceAsync(December23, nextDay, Ct)).Days);
        Assert.True(day.IsOvernightShift);
        Assert.Equal(new TimeOnly(6, 0), day.ScheduledStartTime);
        Assert.Equal(0, day.LateMinutes);
        Assert.Equal(0m, day.LateDeduction);
        Assert.Equal(0m, Assert.Single((await payroll.PreviewPeriodAsync(new(December23, nextDay), Ct)).Items).LateDeduction);

        var rescheduled = await payroll.UpdateAttendanceAsync(day.Id, new(day.TimeIn, day.TimeOut, day.DayCredit,
            null, true, null, ScheduledStartTime: new TimeOnly(20, 0)), Owner, Ct);
        Assert.Equal(60, rescheduled.LateMinutes);
        Assert.Equal(100m, rescheduled.LateDeduction);
    }

    private static Task<EmployeeDto> AddRoasterAsync(PayrollService payroll, int id, string name, string tier, decimal weight,
        bool milestone = false, TimeOnly? shiftStart = null) =>
        payroll.SaveEmployeeAsync(null, new(id, name, "Lechonero", 600m, true, true, tier, weight, milestone)
        {
            DefaultShiftStartTime = shiftStart,
        }, Ct);
}
