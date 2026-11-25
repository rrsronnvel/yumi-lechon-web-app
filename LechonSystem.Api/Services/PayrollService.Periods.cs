using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed partial class PayrollService
{
    public async Task<IReadOnlyList<PayrollPeriodDto>> GetPeriodsAsync(CancellationToken ct)
    {
        var periods = await db.PayrollPeriods.AsNoTracking().OrderByDescending(period => period.EndDate)
            .ThenByDescending(period => period.StartDate).ToListAsync(ct);
        return periods.Select(PeriodDto).ToList();
    }

    public Task<PayrollDetailDto> PreviewPeriodAsync(PayrollDateRange input, CancellationToken ct) => WriteAsync(async () =>
    {
        ValidateRange(input.StartDate, input.EndDate);
        var inferredCycle = InferCycle(input.StartDate, input.EndDate);
        if (input.CycleType is { } requestedCycle && requestedCycle != "Custom" && requestedCycle != inferredCycle)
            throw new ArgumentException("Weekly cutoffs must run Monday through Sunday. Semi-monthly cutoffs must run from the 1st to the 15th or the 16th to the end of the month.");

        var period = await db.PayrollPeriods.Include(p => p.Items)
            .SingleOrDefaultAsync(p => p.StartDate == input.StartDate && p.EndDate == input.EndDate, ct);
        if (period is null)
        {
            period = new PayrollPeriod { StartDate = input.StartDate, EndDate = input.EndDate, PayDate = input.EndDate };
            db.PayrollPeriods.Add(period);
        }
        if (period.Status == PayrollPeriod.Finalized)
            return PayrollDto(period);

        period.CycleType = input.CycleType ?? (period.CycleType == "Custom" ? "Custom" : inferredCycle);
        await RecalculateDraftAsync(period, await GetSettingsAsync(ct), ct);
        await db.SaveChangesAsync(ct);
        return PayrollDto(period);
    }, ct);

    public Task<PayrollDetailDto> UpdatePayrollItemAsync(int id, int itemId, PayrollItemInput input, CancellationToken ct) => WriteAsync(async () =>
    {
        var period = await FindPeriodAsync(id, ct);
        if (period.Status == PayrollPeriod.Finalized)
            throw new PayrollConflictException("This payroll period is finalized and locked.");
        var item = period.Items.SingleOrDefault(row => row.Id == itemId) ?? throw new KeyNotFoundException("Payroll item not found.");

        ValidateMoney(input.OtherBonus, "Other bonus");
        ValidateMoney(input.OtherDeduction, "Other deduction");
        ValidateMoney(input.ValeDeducted, "Vale deduction");
        var manualVale = input.IsValeDeductionManuallyOverridden ??
            (item.IsValeDeductionManuallyOverridden || item.ValeDeducted != input.ValeDeducted);
        if (manualVale && input.ValeDeducted > await ValeBalanceAsync(item.EmployeeId, ct))
            throw new ArgumentException("The Vale deduction cannot exceed the employee's unpaid Vale balance.");

        item.OtherBonus = input.OtherBonus;
        item.OtherBonusRemarks = CleanText(input.OtherBonusRemarks, 1000, "Bonus remarks");
        item.OtherDeduction = input.OtherDeduction;
        item.OtherDeductionRemarks = CleanText(input.OtherDeductionRemarks, 1000, "Deduction remarks");
        item.IsValeDeductionManuallyOverridden = manualVale;
        if (manualVale)
            item.ValeDeducted = input.ValeDeducted;

        await RecalculateDraftAsync(period, await GetSettingsAsync(ct), ct);

        await db.SaveChangesAsync(ct);
        return PayrollDto(period);
    }, ct);

    public Task<PayrollDetailDto> FinalizePeriodAsync(int id, string actor, CancellationToken ct) =>
        FinalizePeriodAsync(id, null, actor, ct);

    public Task<PayrollDetailDto> FinalizePeriodAsync(int id, PayrollFinalizeInput? input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        var period = await FindPeriodAsync(id, ct);
        if (period.Status == PayrollPeriod.Finalized)
            return PayrollDto(period);
        if (await db.PayrollPeriods.AnyAsync(other => other.Id != id && other.Status == PayrollPeriod.Finalized &&
            other.StartDate <= period.EndDate && other.EndDate >= period.StartDate, ct))
            throw new PayrollConflictException("These dates overlap another finalized payroll period.");

        var settings = await GetSettingsAsync(ct);
        await RecalculateDraftAsync(period, settings, ct);
        var invalidVale = period.Items.FirstOrDefault(item => item.ValeDeducted > item.ValeBalanceBefore);
        if (invalidVale != null)
            throw new PayrollConflictException($"{invalidVale.EmployeeNameSnapshot}'s unpaid Vale balance changed. Update the deduction before finalizing.");

        foreach (var item in period.Items.Where(item => item.ValeDeducted > 0m))
        {
            db.CashAdvanceLedger.Add(new CashAdvanceLedger
            {
                EmployeeId = item.EmployeeId,
                TransactionDate = period.PayDate,
                Type = CashAdvanceLedger.PayrollDeduction,
                Amount = item.ValeDeducted,
                PayrollPeriod = period,
                Remarks = $"Pay period {period.StartDate:yyyy-MM-dd} to {period.EndDate:yyyy-MM-dd}",
                RecordedBy = actor,
            });
        }

        period.Status = PayrollPeriod.Finalized;
        period.FinalizedBy = actor;
        period.FinalizedAt = DateTime.UtcNow;
        period.UpdatedAt = period.FinalizedAt;

        if ((input?.SyncToExpenses ?? settings.SyncToExpensesOnFinalize) && period.SyncedExpenseId is null && period.TotalLaborExpense > 0)
            AddPayrollExpense(period, actor, period.FinalizedAt.Value);

        await db.SaveChangesAsync(ct);
        return PayrollDto(period);
    }, ct);

    public Task<PayrollDetailDto> SyncPeriodExpenseAsync(int id, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        var period = await FindPeriodAsync(id, ct);
        if (period.Status != PayrollPeriod.Finalized)
            throw new ArgumentException("Finalize this payroll period before syncing it to Expenses.");

        if (period.SyncedExpenseId is { } expenseId)
        {
            var existing = await db.Expenses.AsNoTracking().SingleOrDefaultAsync(expense => expense.Id == expenseId, ct);
            if (existing is not null)
                return PayrollDto(period, ExpenseService.ToDto(existing, isPayrollSynced: true));
        }

        var laborExpense = CalculateLaborExpense(period);
        if (laborExpense <= 0m)
            throw new ArgumentException("This finalized payroll has no positive labor expense to post.");

        period.TotalLaborExpense = laborExpense;
        var now = DateTime.UtcNow;
        var expense = AddPayrollExpense(period, actor, now);
        period.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return PayrollDto(period, ExpenseService.ToDto(expense, isPayrollSynced: true));
    }, ct);

    private ExpenseRecord AddPayrollExpense(PayrollPeriod period, string actor, DateTime createdAt)
    {
        var paidStaff = period.Items.Count(item => item.DaysWorked > 0 || item.NetPay != 0 || item.ValeDeducted != 0);
        var cashOut = period.Items.Sum(item => item.NetPay);
        var valeSettled = period.Items.Sum(item => item.ValeDeducted);
        var expense = ExpenseService.CreateRecord(new UpsertExpenseRequest
        {
            ExpenseDate = period.PayDate.ToDateTime(TimeOnly.MinValue),
            Category = ExpenseCategorizer.Labor,
            ItemDescription = FormattableString.Invariant($"Payroll ({period.StartDate:MMM dd}–{period.EndDate:MMM dd, yyyy}) • {paidStaff} staff | Cash Out: ₱{cashOut:N2} | Vale Settled: ₱{valeSettled:N2}"),
            Quantity = 1m,
            Unit = "payroll period",
            UnitCost = period.TotalLaborExpense,
            TotalCost = period.TotalLaborExpense,
            PaymentMethod = "Cash",
        }, actor, createdAt);
        db.Expenses.Add(expense);
        period.SyncedExpense = expense;
        return expense;
    }

    private async Task RecalculateDraftAsync(PayrollPeriod period, PayrollSettingsDto settings, CancellationToken ct)
    {
        var start = period.StartDate;
        var end = period.EndDate;
        var days = await LoadCalculatedAttendanceAsync(start, end, settings, ct);
        var worked = days.GroupBy(day => day.EmployeeId).ToDictionary(group => group.Key,
            group => new
            {
                Days = group.Sum(day => day.DayCredit),
                Overtime = group.Where(day => day.OvertimeStatus == AttendanceDay.OvertimeApproved).Sum(day => day.OvertimePay),
                Holiday = group.Sum(day => day.HolidayPremiumPay),
                Late = group.Sum(day => day.LateDeduction),
            });
        var incentives = await GetPeriodIncentivesAsync(start, end, ct);
        var balances = await ValeBalancesAsync(db.CashAdvanceLedger, ct);
        var items = period.Items.ToDictionary(item => item.EmployeeId);
        var employees = await EmployeeRoster().ToListAsync(ct);

        foreach (var employee in employees)
        {
            if (!items.TryGetValue(employee.Id, out var item))
            {
                if (!employee.IsActive && !worked.ContainsKey(employee.Id) && !incentives.ContainsKey(employee.Id))
                    continue;
                item = new PayrollItem { EmployeeId = employee.Id };
                period.Items.Add(item);
            }

            var attendance = worked.GetValueOrDefault(employee.Id);
            item.EmployeeNameSnapshot = employee.FullName;
            item.DaysWorked = attendance?.Days ?? 0m;
            item.DailyRateSnapshot = employee.DailyRate;
            item.BasePay = Math.Round(item.DailyRateSnapshot * item.DaysWorked, 2);
            item.OvertimePay = attendance?.Overtime ?? 0m;
            item.HolidayPremiumPay = attendance?.Holiday ?? 0m;
            item.LateDeduction = attendance?.Late ?? 0m;
            var incentive = incentives.GetValueOrDefault(employee.Id);
            item.PartihanIncentivePay = incentive.Partihan;
            item.MilestoneIncentivePay = incentive.Milestone;
            item.RoastingIncentivePay = item.PartihanIncentivePay + item.MilestoneIncentivePay;
            item.ValeBalanceBefore = balances.GetValueOrDefault(employee.Id);
            var gross = item.BasePay + item.OvertimePay + item.HolidayPremiumPay + item.RoastingIncentivePay + item.OtherBonus;
            var payAfterOtherDeductions = gross - item.LateDeduction - item.OtherDeduction;
            if (!item.IsValeDeductionManuallyOverridden)
                item.ValeDeducted = settings.AutoDeductValeOnPayroll
                    ? Math.Min(item.ValeBalanceBefore, Math.Max(0m, payAfterOtherDeductions))
                    : 0m;
            item.ValeBalanceAfter = Math.Max(0m, item.ValeBalanceBefore - item.ValeDeducted);
            item.NetPay = payAfterOtherDeductions - item.ValeDeducted;
        }

        period.TotalNetPay = period.Items.Sum(item => item.NetPay);
        period.TotalLaborExpense = CalculateLaborExpense(period);
    }

    private static decimal CalculateLaborExpense(PayrollPeriod period) => period.Items.Sum(item => item.NetPay + item.ValeDeducted);

    private static string InferCycle(DateOnly start, DateOnly end)
    {
        if (start.DayOfWeek == DayOfWeek.Monday && end.DayNumber - start.DayNumber == 6)
            return "Weekly";

        if (start.Year == end.Year && start.Month == end.Month &&
            ((start.Day == 1 && end.Day == 15) ||
             (start.Day == 16 && end.Day == DateTime.DaysInMonth(end.Year, end.Month))))
            return "SemiMonthly";

        return "Custom";
    }

    private async Task<PayrollPeriod> FindPeriodAsync(int id, CancellationToken ct) =>
        await db.PayrollPeriods.Include(period => period.Items).SingleOrDefaultAsync(period => period.Id == id, ct)
        ?? throw new KeyNotFoundException("Payroll period not found.");

    private static PayrollPeriodDto PeriodDto(PayrollPeriod p) =>
        new(p.Id, p.StartDate, p.EndDate, p.PayDate, p.Status, p.TotalNetPay, p.FinalizedBy, p.FinalizedAt,
            p.CycleType, p.TotalLaborExpense, p.SyncedExpenseId);

    private static PayrollDetailDto PayrollDto(PayrollPeriod period, ExpenseRecordDto? expense = null) => new(PeriodDto(period),
        period.Items.OrderBy(item => item.EmployeeNameSnapshot).ThenBy(item => item.EmployeeId).Select(item =>
            new PayrollItemDto(item.Id, item.EmployeeId, item.EmployeeNameSnapshot, item.DaysWorked, item.DailyRateSnapshot,
                item.BasePay, item.OvertimePay, item.RoastingIncentivePay, item.OtherBonus, item.OtherBonusRemarks,
                item.ValeBalanceBefore, item.ValeDeducted, item.ValeBalanceAfter, item.OtherDeduction, item.OtherDeductionRemarks,
                item.NetPay, item.HolidayPremiumPay, item.LateDeduction, item.PartihanIncentivePay,
                item.MilestoneIncentivePay, item.IsValeDeductionManuallyOverridden)).ToList(), expense);
}
