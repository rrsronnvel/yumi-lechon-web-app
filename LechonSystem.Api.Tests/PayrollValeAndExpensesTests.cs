using System.Security.Claims;
using System.Text.Json;
using LechonSystem.Api.Common;
using LechonSystem.Api.Controllers;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static LechonSystem.Api.Tests.PayrollServiceTests;

namespace LechonSystem.Api.Tests;

public class PayrollValeAndExpensesTests
{
    private const string Owner = "owner-test";
    private static readonly CancellationToken Ct = CancellationToken.None;
    private static readonly DateOnly Monday = new(2026, 12, 21);
    private static readonly DateOnly Wednesday = Monday.AddDays(2);
    private static readonly DateOnly Sunday = Monday.AddDays(6);

    [Fact]
    public async Task ValeMasterWeekdayAndEarnedCapProtectDisbursementsAndDraftDefaultsToFullDeduction()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddEmployeeAsync(payroll, 1000m);
        await AddWorkDayAsync(payroll, employee.Id, Wednesday);
        await AddWorkDayAsync(payroll, employee.Id, Wednesday.AddDays(1));
        var settings = await payroll.GetSettingsAsync(Ct);
        await payroll.SaveSettingsAsync(settings with { EnableValeSystem = false }, Owner, Ct);

        var disbursement = new ValeInput(employee.Id, Wednesday, CashAdvanceLedger.Disbursement, 200m, null);
        var off = await Assert.ThrowsAsync<ArgumentException>(() =>
            payroll.RecordValeAsync(disbursement with { OverridePolicy = true }, Owner, Ct));
        Assert.Equal("Cash advance (Vale) system is currently turned OFF in Payroll Settings.", off.Message);

        await payroll.SaveSettingsAsync(settings, Owner, Ct);
        var wrongDay = await Assert.ThrowsAsync<ArgumentException>(() =>
            payroll.RecordValeAsync(disbursement with { TransactionDate = Wednesday.AddDays(1) }, Owner, Ct));
        Assert.Equal("Cash advances are only allowed on Wednesday. Check 'Owner Override' to bypass.", wrongDay.Message);

        await payroll.RecordValeAsync(disbursement, Owner, Ct);
        var overCap = await Assert.ThrowsAsync<ArgumentException>(() =>
            payroll.RecordValeAsync(disbursement with { Amount = 801m }, Owner, Ct));
        Assert.Equal("Requested ₱801.00 exceeds earned wages so far this week (₱800.00 max). Check 'Owner Override' to bypass.", overCap.Message);
        var wednesdayBalances = await payroll.GetValeAsync(Wednesday, Ct);
        var valeEmployee = Assert.Single(wednesdayBalances.Employees);
        Assert.Equal(1000m, valeEmployee.CurrentWeekEarnedSoFar);
        Assert.Equal(800m, valeEmployee.MaxAllowedValeNow);

        await payroll.RecordValeAsync(disbursement with { TransactionDate = Wednesday.AddDays(1), Amount = 100m, OverridePolicy = true }, Owner, Ct);
        await payroll.SaveSettingsAsync(settings with { EnableValeSystem = false }, Owner, Ct);
        await payroll.RecordValeAsync(disbursement with { Type = CashAdvanceLedger.CashRepayment, Amount = 50m }, Owner, Ct);

        var cutoff = new PayrollDateRange(Monday, Sunday);
        var draft = await payroll.PreviewPeriodAsync(cutoff, Ct);
        var item = Assert.Single(draft.Items);
        Assert.Equal(250m, item.ValeBalanceBefore);
        Assert.Equal(250m, item.ValeDeducted);
        Assert.Equal(0m, item.ValeBalanceAfter);
        Assert.False(item.IsValeDeductionManuallyOverridden);

        await payroll.UpdatePayrollItemAsync(draft.Period.Id, item.Id, new(0m, null, 100m, 0m, null), Ct);
        var manual = Assert.Single((await payroll.PreviewPeriodAsync(cutoff, Ct)).Items);
        Assert.Equal(100m, manual.ValeDeducted);
        Assert.True(manual.IsValeDeductionManuallyOverridden);

        var restored = await payroll.UpdatePayrollItemAsync(draft.Period.Id, item.Id,
            new(0m, null, 100m, 0m, null, IsValeDeductionManuallyOverridden: false), Ct);
        Assert.Equal(250m, Assert.Single(restored.Items).ValeDeducted);

        var capped = await payroll.UpdatePayrollItemAsync(draft.Period.Id, item.Id,
            new(0m, null, 250m, 1900m, null), Ct);
        var cappedItem = Assert.Single(capped.Items);
        Assert.Equal(100m, cappedItem.ValeDeducted);
        Assert.Equal(150m, cappedItem.ValeBalanceAfter);
        Assert.Equal(0m, cappedItem.NetPay);
    }

    [Fact]
    public async Task VoidingAnAdvanceRestoresTheEarnedCapAndFinalizedDeductionsRejectVoids()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddEmployeeAsync(payroll, 1000m);
        await AddWorkDayAsync(payroll, employee.Id, Wednesday);
        var advance = new ValeInput(employee.Id, Wednesday, CashAdvanceLedger.Disbursement, 500m, "Original memo");
        var entry = await payroll.RecordValeAsync(advance, Owner, Ct);
        var cutoff = new PayrollDateRange(Monday, Sunday);
        Assert.Equal(500m, Assert.Single((await payroll.PreviewPeriodAsync(cutoff, Ct)).Items).ValeDeducted);

        var controller = new PayrollController(payroll)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, Owner)], "test")),
                },
            },
        };
        var before = PhilippineTime.Now;
        var response = Assert.IsType<OkObjectResult>(await controller.VoidVale(entry.Id, new("  Wrong employee  "), Ct));
        var result = Assert.IsType<ValeVoidResultDto>(response.Value);
        Assert.Equal(0m, result.Employee.UnpaidValeBalance);
        Assert.Equal(entry.Id, result.Entry.Id);
        Assert.True(result.Entry.IsVoided);
        Assert.Equal(Owner, result.Entry.VoidedBy);
        Assert.Equal("Wrong employee", result.Entry.VoidReason);
        Assert.NotNull(result.Entry.VoidedAt);
        Assert.InRange(result.Entry.VoidedAt.Value, before, PhilippineTime.Now);
        Assert.Equal("Original memo", result.Entry.Remarks);
        Assert.Equal(500m, result.Entry.Amount);

        var summary = await payroll.GetValeAsync(Wednesday, Ct);
        Assert.Equal(1000m, Assert.Single(summary.Employees).MaxAllowedValeNow);
        Assert.Equal(result.Entry, Assert.Single(summary.Entries));
        Assert.Equal(0m, Assert.Single(await payroll.GetEmployeesAsync(Ct)).UnpaidValeBalance);
        Assert.Equal(0m, Assert.Single((await payroll.PreviewPeriodAsync(cutoff, Ct)).Items).ValeDeducted);
        var duplicate = Assert.IsType<BadRequestObjectResult>(await controller.VoidVale(entry.Id, null, Ct));
        Assert.Equal(400, duplicate.StatusCode);

        await payroll.RecordValeAsync(advance with { Amount = 1000m }, Owner, Ct);
        var draft = await payroll.PreviewPeriodAsync(cutoff, Ct);
        await payroll.FinalizePeriodAsync(draft.Period.Id, new(false), Owner, Ct);
        var settlement = Assert.Single((await payroll.GetValeAsync(Wednesday, Ct)).Entries, row => row.PayrollPeriodId.HasValue);
        var rejected = Assert.IsType<BadRequestObjectResult>(await controller.VoidVale(settlement.Id, null, Ct));
        Assert.Equal(400, rejected.StatusCode);
        Assert.Equal("Cannot void a Vale entry that is already tied to a finalized payroll period.",
            JsonSerializer.SerializeToElement(rejected.Value).GetProperty("message").GetString());
    }

    [Fact]
    public async Task VoidingCashRepaymentRestoresDebtAndUnpaidBalanceStaysNonnegative()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddEmployeeAsync(payroll, 600m);
        await AddWorkDayAsync(payroll, employee.Id, Wednesday);
        var input = new ValeInput(employee.Id, Wednesday, CashAdvanceLedger.Disbursement, 500m, null);
        var advance = await payroll.RecordValeAsync(input, Owner, Ct);
        var repayment = await payroll.RecordValeAsync(input with { Type = CashAdvanceLedger.CashRepayment }, Owner, Ct);

        var voidedRepayment = await payroll.VoidValeAsync(repayment.Id, null, Owner, Ct);
        Assert.Equal(500m, voidedRepayment.Employee.UnpaidValeBalance);
        await payroll.RecordValeAsync(input with { Type = CashAdvanceLedger.CashRepayment }, Owner, Ct);
        var voidedAdvance = await payroll.VoidValeAsync(advance.Id, null, Owner, Ct);
        Assert.Equal(0m, voidedAdvance.Employee.UnpaidValeBalance);
        var draft = Assert.Single((await payroll.PreviewPeriodAsync(new(Monday, Sunday), Ct)).Items);
        Assert.Equal(0m, draft.ValeDeducted);
        Assert.Equal(600m, draft.NetPay);
        Assert.Equal(3, await store.Db.CashAdvanceLedger.CountAsync(Ct));
    }

    [Fact]
    public async Task FinalizePostsCashAndValeAsOneProtectedLaborExpense()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddEmployeeAsync(payroll, 600m);
        for (var i = 0; i < 5; i++)
            await AddWorkDayAsync(payroll, employee.Id, Monday.AddDays(i));
        await payroll.RecordValeAsync(new(employee.Id, Wednesday, CashAdvanceLedger.Disbursement, 500m, null), Owner, Ct);

        var draft = await payroll.PreviewPeriodAsync(new(Monday, Sunday, "Weekly"), Ct);
        Assert.Equal(2500m, draft.Period.TotalNetPay);
        Assert.Equal(500m, Assert.Single(draft.Items).ValeDeducted);
        Assert.Equal(3000m, draft.Period.TotalLaborExpense);

        var finalized = await payroll.FinalizePeriodAsync(draft.Period.Id, new(true), Owner, Ct);
        store.Db.ChangeTracker.Clear();
        var repeated = await payroll.FinalizePeriodAsync(draft.Period.Id, new(true), Owner, Ct);
        Assert.Equal(finalized.Period.SyncedExpenseId, repeated.Period.SyncedExpenseId);
        Assert.Equal(1, await store.Db.CashAdvanceLedger.CountAsync(row => row.Type == CashAdvanceLedger.PayrollDeduction, Ct));

        var expenses = new ExpenseService(store.Db);
        var expense = Assert.Single(await expenses.GetExpensesAsync(2026, 12, "Labor", null, null, null));
        Assert.Equal(expense.Id, repeated.Period.SyncedExpenseId);
        Assert.Equal(3000m, expense.TotalCost);
        Assert.Equal("OPEX", expense.CostType);
        Assert.Equal("Cash", expense.PaymentMethod);
        Assert.Equal(Owner, expense.EncodedBy);
        Assert.Equal(Sunday, DateOnly.FromDateTime(expense.ExpenseDate));
        Assert.Contains("Cash Out: ₱2,500.00 | Vale Settled: ₱500.00", expense.ItemDescription);
        Assert.True(expense.IsPayrollSynced);
        await Assert.ThrowsAsync<PayrollConflictException>(() => expenses.UpdateExpenseAsync(expense.Id, new(), Owner));
        await Assert.ThrowsAsync<PayrollConflictException>(() => expenses.DeleteExpenseAsync(expense.Id));
    }

    [Theory]
    [InlineData(true, false, false)]
    [InlineData(false, null, false)]
    [InlineData(false, true, true)]
    public async Task FinalizeHonorsExpenseDefaultAndPerPeriodChoice(bool configured, bool? requested, bool synced)
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var employee = await AddEmployeeAsync(payroll, 600m);
        await AddWorkDayAsync(payroll, employee.Id, Monday);
        var settings = await payroll.GetSettingsAsync(Ct);
        await payroll.SaveSettingsAsync(settings with { SyncToExpensesOnFinalize = configured }, Owner, Ct);

        var draft = await payroll.PreviewPeriodAsync(new(new(2026, 12, 16), new(2026, 12, 31)), Ct);
        Assert.Equal("SemiMonthly", draft.Period.CycleType);

        var finalized = await payroll.FinalizePeriodAsync(draft.Period.Id, new(requested), Owner, Ct);
        var repeated = await payroll.FinalizePeriodAsync(draft.Period.Id, Owner, Ct);
        Assert.Equal(synced, finalized.Period.SyncedExpenseId.HasValue);
        Assert.Equal(finalized.Period.SyncedExpenseId, repeated.Period.SyncedExpenseId);
        Assert.Equal(synced ? 1 : 0, await store.Db.Expenses.CountAsync(Ct));
    }

    private static Task<EmployeeDto> AddEmployeeAsync(PayrollService payroll, decimal dailyRate) =>
        payroll.SaveEmployeeAsync(null, new(1, "Payroll Test", "Prep", dailyRate, null, true), Ct);

    private static Task<AttendanceDayDto> AddWorkDayAsync(PayrollService payroll, int employeeId, DateOnly date) =>
        payroll.AddAttendanceAsync(new(employeeId, date, new(null, null, 1m, 0m, true, null)), Owner, Ct);
}
