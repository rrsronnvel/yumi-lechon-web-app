using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Tests;

public class PayrollServiceTests
{
    private const string Owner = "owner-test";
    private static readonly CancellationToken Ct = CancellationToken.None;
    private static readonly DateOnly December23 = new(2026, 12, 23);

    [Fact]
    public async Task ReuploadSkipsExistingPunchesAndUnmappedPunchesAreAvailableAfterLinking()
    {
        await using var store = await PayrollStore.OpenAsync();
        using var export = DeliBiff8Fixture.Create(December23, December23, [(23, "06:00\n14:00")]);
        var file = DeliBiff8Fixture.AsUpload(export);

        var initial = await store.Payroll.ImportAttendanceAsync([file], Owner, Ct);
        var repeated = await store.Payroll.ImportAttendanceAsync([file], Owner, Ct);

        Assert.Equal(2, initial.PunchesImported);
        Assert.Equal(1, Assert.Single(initial.UnmappedUsers).BiometricUserId);
        Assert.Equal(0, repeated.PunchesImported);
        Assert.Equal(2, repeated.DuplicatesSkipped);
        Assert.Equal(2, await store.Db.RawAttendancePunches.CountAsync(Ct));
        Assert.Equal(2, await store.Db.BiometricImportBatches.CountAsync(Ct));

        var employee = await AddEmployee(store.Payroll, 1);
        var attendance = await store.Payroll.GetAttendanceAsync(December23, December23, Ct);
        Assert.Empty(attendance.UnmappedUsers);
        var day = Assert.Single(attendance.Days);
        Assert.Equal(employee.Id, day.EmployeeId);
        Assert.Equal(1m, day.DayCredit);
        Assert.Equal(8m, day.TotalHours);
    }

    [Fact]
    public async Task OvernightUsesEveningWorkDateAndDoesNotCreateMorningRow()
    {
        await using var store = await PayrollStore.OpenAsync();
        await AddEmployee(store.Payroll, 1);
        var nextDay = December23.AddDays(1);
        using var export = DeliBiff8Fixture.Create(December23, nextDay, [(23, "21:00"), (24, "06:00")]);

        await store.Payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(export)], Owner, Ct);

        var attendance = Assert.Single((await store.Payroll.GetAttendanceAsync(December23, nextDay, Ct)).Days);
        Assert.Equal(December23, attendance.WorkDate);
        Assert.Equal(December23.ToDateTime(new TimeOnly(21, 0)), attendance.TimeIn);
        Assert.Equal(nextDay.ToDateTime(new TimeOnly(6, 0)), attendance.TimeOut);
        Assert.True(attendance.IsOvernightShift);
        Assert.Equal(9m, attendance.TotalHours);
        Assert.Equal(1m, attendance.DayCredit);
        Assert.Equal(1, await store.Db.AttendanceDays.CountAsync(Ct));
    }

    [Fact]
    public async Task LateDecemberExportStitchesAcrossYearsAndReimportPreservesOwnerOverride()
    {
        await using var store = await PayrollStore.OpenAsync();
        await AddEmployee(store.Payroll, 1);
        var evening = new DateOnly(2026, 12, 31);
        var morning = evening.AddDays(1);
        using var january = DeliBiff8Fixture.Create(morning, morning, [(1, "06:00")]);
        await store.Payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(january)], Owner, Ct);
        Assert.Equal("MissingPunch", Assert.Single((await store.Payroll.GetAttendanceAsync(evening, morning, Ct)).Days).ExceptionFlag);

        using var december = DeliBiff8Fixture.Create(evening, evening, [(31, "21:00")]);
        await store.Payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(december)], Owner, Ct);
        var day = Assert.Single((await store.Payroll.GetAttendanceAsync(evening, morning, Ct)).Days);
        Assert.Equal(evening, day.WorkDate);
        Assert.True(day.IsOvernightShift);

        await store.Payroll.UpdateAttendanceAsync(day.Id, new(day.TimeIn, day.TimeOut, 0.5m, 150m, true, "Approved"), Owner, Ct);
        await store.Payroll.DecideOvertimeAsync(day.Id, new("Approve"), Owner, Ct);
        using var additional = DeliBiff8Fixture.Create(evening, evening, [(31, "21:00\n21:03")]);
        await store.Payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(additional)], Owner, Ct);

        var saved = Assert.Single((await store.Payroll.GetAttendanceAsync(evening, morning, Ct)).Days);
        Assert.True(saved.IsManuallyOverridden);
        Assert.Equal(0.5m, saved.DayCredit);
        Assert.Equal(150m, saved.OvertimePay);
        Assert.Equal("Approved", saved.Notes);
        Assert.Equal(day.TimeIn, saved.TimeIn);
    }

    [Theory]
    [InlineData("06:00\n06:14", "MissingPunch", 0)]
    [InlineData("06:00\n06:15", "ShortShift", 1)]
    [InlineData("06:00\n11:00", "None", 1)]
    [InlineData("06:00\n16:00", "None", 1)]
    [InlineData("06:00\n16:01", "LongShift", 1)]
    public async Task CreditUsesShortAndLongShiftBoundaries(string punches, string flag, int credit)
    {
        await using var store = await PayrollStore.OpenAsync();
        await AddEmployee(store.Payroll, 1);
        using var export = DeliBiff8Fixture.Create(December23, December23, [(23, punches)]);
        await store.Payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(export)], Owner, Ct);

        var day = Assert.Single((await store.Payroll.GetAttendanceAsync(December23, December23, Ct)).Days);

        Assert.Equal(flag, day.ExceptionFlag);
        Assert.Equal(credit, day.DayCredit);
    }

    [Theory]
    [InlineData("Double-tap / <15m span — verify", 1, null)]
    [InlineData("Owner verified the shift", 0, "Owner verified the shift")]
    public async Task CorrectingDoubleTapClearsOnlyTheSystemNoteAndKeepsSelectedCredit(string note, int credit, string? expectedNote)
    {
        await using var store = await PayrollStore.OpenAsync();
        await AddEmployee(store.Payroll, 1);
        using var export = DeliBiff8Fixture.Create(December23, December23, [(23, "06:00\n06:04")]);
        await store.Payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(export)], Owner, Ct);
        var broken = Assert.Single((await store.Payroll.GetAttendanceAsync(December23, December23, Ct)).Days);
        Assert.Equal("Double-tap / <15m span — verify", broken.Notes);
        Assert.Equal("MissingPunch", broken.ExceptionFlag);
        Assert.Equal(0m, broken.DayCredit);

        await store.Payroll.UpdateAttendanceAsync(broken.Id, new(
            broken.TimeIn, December23.ToDateTime(new TimeOnly(16, 0)), credit, null, true, note), Owner, Ct);

        var corrected = Assert.Single((await store.Payroll.GetAttendanceAsync(December23, December23, Ct)).Days);
        Assert.Equal(expectedNote, corrected.Notes);
        Assert.Equal("None", corrected.ExceptionFlag);
        Assert.Equal(10m, corrected.TotalHours);
        Assert.Equal(credit, corrected.DayCredit);
        Assert.Equal(0, corrected.LateMinutes);
        Assert.Equal(0m, corrected.LateDeduction);
        Assert.Equal(0m, corrected.SuggestedOvertimeHours);
        Assert.Equal(AttendanceDay.NoOvertime, corrected.OvertimeStatus);
        Assert.True(corrected.IsManuallyOverridden);
    }

    [Fact]
    public async Task SavingInlineCreditClearsAnOldDoubleTapNoteOnAValidShift()
    {
        await using var store = await PayrollStore.OpenAsync();
        var employee = await AddEmployee(store.Payroll, 1);
        var day = new AttendanceDay
        {
            EmployeeId = employee.Id, WorkDate = December23, DayCredit = 0m, TotalHours = 10m,
            TimeIn = December23.ToDateTime(new TimeOnly(6, 0)), TimeOut = December23.ToDateTime(new TimeOnly(16, 0)),
            IsManuallyOverridden = true, Notes = "Double-tap / <15m span — verify",
        };
        store.Db.AttendanceDays.Add(day);
        await store.Db.SaveChangesAsync(Ct);

        var updated = await store.Payroll.UpdateAttendanceAsync(day.Id, new(day.TimeIn, day.TimeOut, 1m, null, true, day.Notes), Owner, Ct);

        Assert.Equal(1m, updated.DayCredit);
        Assert.Equal("None", updated.ExceptionFlag);
        Assert.Equal(10m, updated.TotalHours);
        Assert.Null(updated.Notes);
        Assert.Null((await store.Db.AttendanceDays.AsNoTracking().SingleAsync(Ct)).Notes);
    }

    [Fact]
    public async Task NovemberQaSeedFillsTheRosterWithoutReplacingPunchesOrAttendance()
    {
        await using var store = await PayrollStore.OpenAsync();
        var employee = await AddEmployee(store.Payroll, 1);
        var monday = new DateOnly(2026, 11, 23);
        var saturday = new DateOnly(2026, 11, 28);
        using var export = DeliBiff8Fixture.Create(monday, monday, [(23, "06:04\n06:08")]);
        await store.Payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(export)], Owner, Ct);
        var liveDay = Assert.Single((await store.Payroll.GetAttendanceAsync(monday, monday, Ct)).Days);
        var existingSaturday = await store.Payroll.AddAttendanceAsync(new(employee.Id, saturday,
            new(saturday.ToDateTime(new TimeOnly(7, 0)), saturday.ToDateTime(new TimeOnly(13, 0)),
                0.5m, null, true, "Owner review")), Owner, Ct);

        await PayrollNov2026QaSeed.SeedAsync(store.Db, Ct);
        await PayrollNov2026QaSeed.SeedAsync(store.Db, Ct);
        store.Db.ChangeTracker.Clear();

        var roster = await store.Payroll.GetEmployeesAsync(Ct);
        Assert.Equal(7, roster.Count);
        var linked = Assert.Single(roster, member => member.BiometricUserId == 1);
        Assert.Equal(employee.Id, linked.Id);
        Assert.Equal(employee.DailyRate, linked.DailyRate);
        Assert.Equal("Leader", linked.IncentiveTier);
        Assert.Equal(8m, linked.IncentiveWeight);
        Assert.Equal(new TimeOnly(6, 0), linked.DefaultShiftStartTime);

        var storedDays = await store.Db.AttendanceDays.AsNoTracking().ToListAsync(Ct);
        Assert.Equal(8, storedDays.Count);
        Assert.Equal(liveDay.Notes, Assert.Single(storedDays, day => day.Id == liveDay.Id).Notes);
        var preserved = Assert.Single(storedDays, day => day.Id == existingSaturday.Id);
        Assert.Equal(existingSaturday.TimeIn, preserved.TimeIn);
        Assert.Equal(0.5m, preserved.DayCredit);
        Assert.Equal("Owner review", preserved.Notes);
        Assert.Equal(2, await store.Db.RawAttendancePunches.CountAsync(Ct));

        var seededDays = storedDays.Where(day => day.WorkDate == saturday && day.EmployeeId != employee.Id).ToList();
        Assert.Equal(6, seededDays.Count);
        Assert.All(seededDays, day =>
        {
            Assert.Equal(saturday.ToDateTime(new TimeOnly(6, 0)), day.TimeIn);
            Assert.Equal(saturday.ToDateTime(new TimeOnly(15, 0)), day.TimeOut);
            Assert.Equal(9m, day.TotalHours);
            Assert.Equal(1m, day.DayCredit);
            Assert.True(day.IsReviewed);
            Assert.True(day.IsManuallyOverridden);
        });
    }

    [Fact]
    public async Task BonusUsesBellyRatioAndSplitsByActiveRoasterCredits()
    {
        await using var store = await PayrollStore.OpenAsync();
        // Existing production keeps the Phase 1 quota and three-belly snapshot after the upgrade.
        store.Db.DailyRoastProduction.Add(new DailyRoastProduction
        {
            ProductionDate = December23, BelliesPerWholeSnapshot = 3, QuotaSnapshot = 4, BonusPerExcessSnapshot = 50m,
        });
        await store.Db.SaveChangesAsync(Ct);
        var first = await AddEmployee(store.Payroll, 1);
        var second = await AddEmployee(store.Payroll, 2);
        var inactive = await AddEmployee(store.Payroll, 3, active: false);
        var helper = await AddEmployee(store.Payroll, 4, role: "Helper");
        var worked = new AttendanceInput(null, null, 1m, 0m, true, null);
        await store.Payroll.AddAttendanceAsync(new(first.Id, December23, worked), Owner, Ct);
        var secondDay = await store.Payroll.AddAttendanceAsync(new(second.Id, December23, worked), Owner, Ct);
        await store.Payroll.AddAttendanceAsync(new(inactive.Id, December23, worked), Owner, Ct);
        await store.Payroll.AddAttendanceAsync(new(helper.Id, December23, worked), Owner, Ct);

        var saved = Assert.Single(await store.Payroll.SaveRoastProductionAsync([new(December23, 4, 6)], Owner, Ct));

        Assert.Equal(3, saved.BelliesPerWholeSnapshot);
        Assert.Equal(6, saved.EquivalentLechons);
        Assert.Equal(100m, saved.TotalBonusPool);
        Assert.Equal(new[] { first.Id, second.Id }, saved.Shares.Select(share => share.EmployeeId));
        Assert.All(saved.Shares, share => Assert.Equal(50m, share.Share));

        await store.Payroll.UpdateAttendanceAsync(secondDay.Id, worked with { DayCredit = 0.5m }, Owner, Ct);
        await store.Payroll.SaveSettingsAsync(new(4, 50m, 2), Owner, Ct);
        var next = December23.AddDays(1);
        var days = await store.Payroll.SaveRoastProductionAsync([new(December23, 4, 6), new(next, 4, 6)], Owner, Ct);
        Assert.Equal(3, days[0].BelliesPerWholeSnapshot);
        Assert.Equal(new[] { 66.67m, 33.33m }, days[0].Shares.Select(share => share.Share));
        Assert.Equal(2, days[1].BelliesPerWholeSnapshot);
        Assert.Equal(150m, days[1].TotalBonusPool);

        var payroll = await store.Payroll.PreviewPeriodAsync(new(December23, next), Ct);
        Assert.Equal(66.67m, payroll.Items.Single(item => item.EmployeeId == first.Id).RoastingIncentivePay);
        Assert.Equal(33.33m, payroll.Items.Single(item => item.EmployeeId == second.Id).RoastingIncentivePay);
    }

    [Fact]
    public async Task FinalizedPartialDeductionAppendsOneLedgerEntryAndRollsOverTheRemainder()
    {
        await using var store = await PayrollStore.OpenAsync();
        var employee = await AddEmployee(store.Payroll, 1);
        var week = new PayrollDateRange(December23.AddDays(-2), December23.AddDays(4));
        var attendance = await store.Payroll.AddAttendanceAsync(new(employee.Id, December23, new(null, null, 1m, 25m, true, null)), Owner, Ct);
        await store.Payroll.DecideOvertimeAsync(attendance.Id, new("Approve"), Owner, Ct);
        await store.Payroll.RecordValeAsync(new(employee.Id, December23, CashAdvanceLedger.Disbursement, 1500m, null, OverridePolicy: true), Owner, Ct);
        var draft = await store.Payroll.PreviewPeriodAsync(week, Ct);
        var item = Assert.Single(draft.Items);
        Assert.Equal(1500m, item.ValeBalanceBefore);

        await store.Payroll.UpdatePayrollItemAsync(draft.Period.Id, item.Id, new(100m, "Holiday prep", 500m, 10m, "Other"), Ct);
        var preview = Assert.Single((await store.Payroll.PreviewPeriodAsync(week, Ct)).Items);
        Assert.Equal(500m, preview.ValeDeducted);
        Assert.Equal("Holiday prep", preview.OtherBonusRemarks);
        Assert.Equal(415m, preview.NetPay);

        var finalized = await store.Payroll.FinalizePeriodAsync(draft.Period.Id, Owner, Ct);
        await store.Payroll.FinalizePeriodAsync(draft.Period.Id, Owner, Ct);
        Assert.Equal(PayrollPeriod.Finalized, finalized.Period.Status);
        Assert.Equal(Owner, finalized.Period.FinalizedBy);
        Assert.Equal(1000m, Assert.Single(finalized.Items).ValeBalanceAfter);
        var vale = await store.Payroll.GetValeAsync(Ct);
        var deduction = Assert.Single(vale.Entries, entry => entry.Type == CashAdvanceLedger.PayrollDeduction);
        Assert.Equal(500m, deduction.Amount);
        Assert.Equal(Owner, deduction.RecordedBy);
        Assert.Equal(week.EndDate, deduction.TransactionDate);
        Assert.Equal(1000m, Assert.Single(vale.Employees).UnpaidValeBalance);
        Assert.Equal(1000m, Assert.Single(await store.Payroll.GetEmployeesAsync(Ct)).UnpaidValeBalance);
        await Assert.ThrowsAsync<PayrollConflictException>(() =>
            store.Payroll.UpdatePayrollItemAsync(draft.Period.Id, item.Id, new(0m, null, 0m, 0m, null), Ct));
    }

    private static Task<EmployeeDto> AddEmployee(PayrollService payroll, int id, bool active = true, string role = "Lechonero") =>
        payroll.SaveEmployeeAsync(null, new(id, $"Employee {id}", role, 800m, null, active), Ct);

    internal sealed class PayrollStore(SqliteConnection connection, LechonDbContext db) : IAsyncDisposable
    {
        public LechonDbContext Db { get; } = db;
        public PayrollService Payroll { get; } = new(db, new DeliAttendanceParser());

        public static async Task<PayrollStore> OpenAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync(Ct);
            var options = new DbContextOptionsBuilder<LechonDbContext>().UseSqlite(connection).Options;
            var db = new TestDbContext(options);
            await db.Database.EnsureCreatedAsync(Ct);
            return new PayrollStore(connection, db);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    private sealed class TestDbContext(DbContextOptions<LechonDbContext> options) : LechonDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            builder.Entity<PromoPackage>().Property(promo => promo.IncludedItemsJson).HasColumnType("TEXT");
        }
    }
}
