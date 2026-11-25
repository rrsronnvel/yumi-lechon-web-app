using System.Globalization;
using LechonSystem.Api.Common;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed class PayrollConflictException(string message) : Exception(message);

public sealed partial class PayrollService(LechonDbContext db, DeliAttendanceParser parser)
{
    private const decimal MaximumMoney = 9_999_999_999_999_999.99m;
    private static readonly string[] EmployeeRoles = ["Lechonero", "Prep", "Kitchen", "Cashier", "Helper"];

    public async Task<IReadOnlyList<EmployeeDto>> GetEmployeesAsync(CancellationToken ct)
    {
        var employees = await EmployeeRoster().ToListAsync(ct);
        var balances = await ValeBalancesAsync(db.CashAdvanceLedger, ct);
        return employees.Select(employee => EmployeeDto(employee, balances.GetValueOrDefault(employee.Id))).ToList();
    }

    public Task<EmployeeDto> SaveEmployeeAsync(int? id, EmployeeInput input, CancellationToken ct) => WriteAsync(async () =>
    {
        if (input.BiometricUserId <= 0)
            throw new ArgumentException("Enter a positive Deli User ID.");

        var name = CleanText(input.FullName, 120, "Employee name") ?? throw new ArgumentException("Enter the employee's name.");
        if (!EmployeeRoles.Contains(input.Role))
            throw new ArgumentException("Select a valid employee role.");
        ValidateMoney(input.DailyRate, "Daily rate");

        var existing = id.HasValue ? await FindEmployeeAsync(id.Value, ct) : null;
        if (await db.Employees.AnyAsync(e => e.BiometricUserId == input.BiometricUserId && e.Id != id, ct))
            throw new PayrollConflictException("This Deli User ID is already linked to an employee.");

        var employee = existing ?? new Employee();
        var mappingChanged = employee.BiometricUserId != input.BiometricUserId;
        var tier = input.IncentiveTier ?? employee.IncentiveTier;
        var tierWeight = tier switch
        {
            "Leader" => 8m,
            "Assistant" => 5m,
            "Newbie" => 3m,
            "None" => 0m,
            _ => throw new ArgumentException("Select a valid incentive tier."),
        };
        var weight = input.IncentiveWeight ?? (tier == employee.IncentiveTier ? employee.IncentiveWeight : tierWeight);
        if (weight < 0 || weight > 9999.99m || decimal.Round(weight, 2) != weight)
            throw new ArgumentException("Incentive weight must be between 0 and 9999.99 with at most two decimal places.");

        employee.IsIncentiveEligible = input.IsIncentiveEligible ??
            (employee.Role == input.Role ? employee.IsIncentiveEligible : input.Role == "Lechonero");
        employee.BiometricUserId = input.BiometricUserId;
        employee.FullName = name;
        employee.Role = input.Role;
        employee.DailyRate = input.DailyRate;
        employee.IsActive = input.IsActive ?? employee.IsActive;
        employee.IncentiveTier = tier;
        employee.IncentiveWeight = weight;
        employee.HasMilestoneBonus = input.HasMilestoneBonus ?? employee.HasMilestoneBonus;
        if (input.HasDefaultShiftStartTime)
            employee.DefaultShiftStartTime = input.DefaultShiftStartTime;
        if (existing is null)
            db.Employees.Add(employee);
        else
            employee.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        if (mappingChanged)
        {
            await RebuildAttendanceAsync([employee], ct);
            await db.SaveChangesAsync(ct);
        }

        return EmployeeDto(employee, await ValeBalanceAsync(employee.Id, ct));
    }, ct);

    public Task<EmployeeDto> SetEmployeeStatusAsync(int id, bool isActive, CancellationToken ct) => WriteAsync(async () =>
    {
        var employee = await FindEmployeeAsync(id, ct);
        employee.IsActive = isActive;
        employee.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return EmployeeDto(employee, await ValeBalanceAsync(id, ct));
    }, ct);

    public Task<ValeSummaryDto> GetValeAsync(CancellationToken ct) => GetValeAsync(null, ct);

    public async Task<ValeSummaryDto> GetValeAsync(DateOnly? asOf, CancellationToken ct)
    {
        var date = asOf ?? DateOnly.FromDateTime(PhilippineTime.Today);
        var weekStart = ValeWeekStart(date);
        var weekEnd = ValeWeekEnd(weekStart);
        var settings = await GetSettingsAsync(ct);
        var entries = await db.CashAdvanceLedger.AsNoTracking().Include(entry => entry.Employee)
            .OrderBy(entry => entry.TransactionDate).ThenBy(entry => entry.Id).ToListAsync(ct);
        var activeEntries = entries.Where(entry => !entry.IsVoided);
        var balances = activeEntries.GroupBy(entry => entry.EmployeeId).ToDictionary(group => group.Key,
            group => Math.Max(0m, group.Sum(entry => entry.Type == CashAdvanceLedger.Disbursement ? entry.Amount : -entry.Amount)));
        var advances = activeEntries.Where(entry => entry.Type == CashAdvanceLedger.Disbursement &&
                entry.TransactionDate >= weekStart && entry.TransactionDate <= weekEnd)
            .GroupBy(entry => entry.EmployeeId).ToDictionary(group => group.Key, group => group.Sum(entry => entry.Amount));
        var earned = await EarnedValeWagesAsync(weekStart, date, null, ct);
        var employees = await EmployeeRoster().ToListAsync(ct);
        return new ValeSummaryDto(employees.Select(employee => ValeEmployeeDto(employee, balances.GetValueOrDefault(employee.Id),
            earned.GetValueOrDefault(employee.Id), advances.GetValueOrDefault(employee.Id))).ToList(), entries.Select(ValeDto).ToList(),
            date, settings.EnableValeSystem, settings.ValeAllowedDayOfWeek, settings.EnforceValeEarnedCap);
    }

    public Task<ValeEntryDto> RecordValeAsync(ValeInput input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        if (input.Type is not (CashAdvanceLedger.Disbursement or CashAdvanceLedger.CashRepayment))
            throw new ArgumentException("Record a disbursement or cash repayment. Payroll records deductions when finalized.");
        if (input.TransactionDate == default)
            throw new ArgumentException("Enter the Vale transaction date.");
        ValidateMoney(input.Amount, "Vale amount", positive: true);

        var employee = await FindEmployeeAsync(input.EmployeeId, ct);
        if (input.Type == CashAdvanceLedger.Disbursement)
            await ValidateValeDisbursementAsync(input, ct);
        if (input.Type == CashAdvanceLedger.CashRepayment && input.Amount > await ValeBalanceAsync(employee.Id, ct))
            throw new ArgumentException("The cash repayment cannot exceed the employee's unpaid Vale balance.");

        var entry = new CashAdvanceLedger
        {
            Employee = employee,
            TransactionDate = input.TransactionDate,
            Type = input.Type,
            Amount = input.Amount,
            Remarks = CleanText(input.Remarks, 1000, "Remarks"),
            RecordedBy = actor,
        };
        db.CashAdvanceLedger.Add(entry);
        await db.SaveChangesAsync(ct);
        return ValeDto(entry);
    }, ct);

    public Task<ValeVoidResultDto> VoidValeAsync(int id, ValeVoidInput? input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        var entry = await db.CashAdvanceLedger.Include(row => row.Employee).SingleOrDefaultAsync(row => row.Id == id, ct)
            ?? throw new KeyNotFoundException("Vale entry not found.");
        if (entry.PayrollPeriodId.HasValue)
            throw new ArgumentException("Cannot void a Vale entry that is already tied to a finalized payroll period.");
        if (entry.IsVoided)
            throw new ArgumentException("This Vale entry is already voided.");

        var voidedAt = PhilippineTime.Now;
        entry.VoidReason = CleanText(input?.Reason, 250, "Void reason");
        entry.IsVoided = true;
        entry.VoidedBy = actor.Length <= 120 ? actor : actor[..120];
        entry.VoidedAt = voidedAt;
        await db.SaveChangesAsync(ct);

        var date = DateOnly.FromDateTime(voidedAt);
        var weekStart = ValeWeekStart(date);
        var balance = await ValeBalanceAsync(entry.EmployeeId, ct);
        var earned = await EarnedValeWagesAsync(weekStart, date, entry.EmployeeId, ct);
        var advances = await WeeklyValeAdvancesAsync(entry.EmployeeId, weekStart, ct);
        return new ValeVoidResultDto(ValeEmployeeDto(entry.Employee, balance, earned.GetValueOrDefault(entry.EmployeeId), advances), ValeDto(entry));
    }, ct);

    private async Task ValidateValeDisbursementAsync(ValeInput input, CancellationToken ct)
    {
        var settings = await GetSettingsAsync(ct);
        if (!settings.EnableValeSystem)
            throw new ArgumentException("Cash advance (Vale) system is currently turned OFF in Payroll Settings.");
        if (input.OverridePolicy)
            return;

        if (settings.ValeAllowedDayOfWeek != "Any" && input.TransactionDate.DayOfWeek.ToString() != settings.ValeAllowedDayOfWeek)
            throw new ArgumentException($"Cash advances are only allowed on {settings.ValeAllowedDayOfWeek}. Check 'Owner Override' to bypass.");
        if (!settings.EnforceValeEarnedCap)
            return;

        var weekStart = ValeWeekStart(input.TransactionDate);
        var earned = await EarnedValeWagesAsync(weekStart, input.TransactionDate, input.EmployeeId, ct);
        var advances = await WeeklyValeAdvancesAsync(input.EmployeeId, weekStart, ct);
        var maximum = Math.Max(0m, earned.GetValueOrDefault(input.EmployeeId) - advances);
        if (input.Amount > maximum)
            throw new ArgumentException(FormattableString.Invariant(
                $"Requested ₱{input.Amount:N2} exceeds earned wages so far this week (₱{maximum:N2} max). Check 'Owner Override' to bypass."));
    }

    private async Task<Dictionary<int, decimal>> EarnedValeWagesAsync(DateOnly weekStart, DateOnly date, int? employeeId,
        CancellationToken ct)
    {
        var worked = await AttendanceInRange(weekStart, date).AsNoTracking()
            .Where(day => !employeeId.HasValue || day.EmployeeId == employeeId.Value)
            .Select(day => new { day.EmployeeId, day.DayCredit, day.Employee.DailyRate }).ToListAsync(ct);
        return worked.GroupBy(day => day.EmployeeId).ToDictionary(group => group.Key,
            group => Math.Round(group.Sum(day => day.DayCredit * day.DailyRate), 2));
    }

    private static DateOnly ValeWeekStart(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
    private static DateOnly ValeWeekEnd(DateOnly start) => start.AddDays(Math.Min(6, DateOnly.MaxValue.DayNumber - start.DayNumber));

    private async Task<decimal> WeeklyValeAdvancesAsync(int employeeId, DateOnly weekStart, CancellationToken ct)
    {
        var weekEnd = ValeWeekEnd(weekStart);
        return await db.CashAdvanceLedger.Where(entry => !entry.IsVoided && entry.EmployeeId == employeeId &&
                entry.Type == CashAdvanceLedger.Disbursement && entry.TransactionDate >= weekStart && entry.TransactionDate <= weekEnd)
            .SumAsync(entry => (decimal?)entry.Amount, ct) ?? 0m;
    }

    private static Task<Dictionary<int, decimal>> ValeBalancesAsync(IQueryable<CashAdvanceLedger> entries, CancellationToken ct) =>
        entries.AsNoTracking().Where(entry => !entry.IsVoided).GroupBy(entry => entry.EmployeeId)
            .Select(group => new
            {
                EmployeeId = group.Key,
                Balance = group.Sum(entry => entry.Type == CashAdvanceLedger.Disbursement ? entry.Amount : -entry.Amount),
            })
            .ToDictionaryAsync(row => row.EmployeeId, row => Math.Max(0m, row.Balance), ct);

    private async Task<decimal> ValeBalanceAsync(int employeeId, CancellationToken ct)
    {
        var balances = await ValeBalancesAsync(db.CashAdvanceLedger.Where(entry => entry.EmployeeId == employeeId), ct);
        return balances.GetValueOrDefault(employeeId);
    }

    private IQueryable<Employee> EmployeeRoster() => db.Employees.AsNoTracking()
        .OrderByDescending(employee => employee.IsActive).ThenBy(employee => employee.FullName).ThenBy(employee => employee.Id);

    private async Task<Employee> FindEmployeeAsync(int id, CancellationToken ct) =>
        await db.Employees.FindAsync([id], ct) ?? throw new KeyNotFoundException("Employee not found.");

    private static EmployeeDto EmployeeDto(Employee e, decimal balance) =>
        new(e.Id, e.BiometricUserId, e.FullName, e.Role, e.DailyRate, e.IsIncentiveEligible, e.IsActive, balance,
            e.IncentiveTier, e.IncentiveWeight, e.HasMilestoneBonus, e.DefaultShiftStartTime);

    private static EmployeeDto ValeEmployeeDto(Employee employee, decimal balance, decimal wages, decimal advances) =>
        EmployeeDto(employee, balance) with { CurrentWeekEarnedSoFar = wages, MaxAllowedValeNow = Math.Max(0m, wages - advances) };

    private static ValeEntryDto ValeDto(CashAdvanceLedger entry) =>
        new(entry.Id, entry.EmployeeId, entry.Employee.FullName, entry.TransactionDate, entry.Type, entry.Amount,
            entry.PayrollPeriodId, entry.Remarks, entry.RecordedBy, entry.IsVoided, entry.VoidedBy, entry.VoidedAt, entry.VoidReason);

    private async Task<T> WriteAsync<T>(Func<Task<T>> action, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (db.Database.IsSqlServer())
        {
            // Payroll writes share attendance, draft and ledger state across requests and API instances.
            await db.Database.ExecuteSqlRawAsync("""
                DECLARE @result int;
                EXEC @result = sys.sp_getapplock @Resource = N'YumisLechon.Payroll',
                    @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
                IF @result < 0 THROW 51000, 'Could not acquire the payroll write lock.', 1;
                """, ct);
        }

        var result = await action();
        await transaction.CommitAsync(ct);
        return result;
    }

    private static void ValidateRange(DateOnly startDate, DateOnly endDate)
    {
        if (startDate == default || endDate == DateOnly.MaxValue || endDate < startDate || endDate.DayNumber - startDate.DayNumber >= 31)
            throw new ArgumentException("Select a start and end date covering up to 31 days.");
    }

    private static void ValidateMoney(decimal value, string label, bool positive = false)
    {
        if (value < 0 || (positive && value == 0) || value > MaximumMoney || decimal.Round(value, 2) != value)
            throw new ArgumentException($"{label} must be {(positive ? "positive" : "non-negative")} and use at most two decimal places.");
    }

    private static string? CleanText(string? value, int maximumLength, string label)
    {
        var text = value?.Trim();
        if (text?.Length > maximumLength)
            throw new ArgumentException($"{label} can have at most {maximumLength} characters.");
        return string.IsNullOrEmpty(text) ? null : text;
    }
}
