using System.Security.Claims;
using LechonSystem.Api.Controllers;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Tests;

public class PayrollExpenseSyncTests
{
    private const string Owner = "owner-test";
    private static readonly DateOnly Monday = new(2026, 11, 16);
    private static readonly DateOnly Wednesday = Monday.AddDays(2);
    private static readonly DateOnly Sunday = Monday.AddDays(6);
    private static readonly CancellationToken Ct = CancellationToken.None;

    [Fact]
    public async Task FinalizationPostsAnExpenseMatchedByThePayDateMonthAndLedgerFilters()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var draft = await PreparePayrollAsync(store.Payroll);

        var finalized = await store.Payroll.FinalizePeriodAsync(draft.Period.Id, new(true), Owner, Ct);
        store.Db.ChangeTracker.Clear();
        var expenses = new ExpensesController(new ExpenseService(store.Db));
        var november = Assert.IsType<OkObjectResult>(await expenses.GetExpenses(2026, 11, "Labor", "OPEX", "Cash", "Vale Settled"));
        var december = Assert.IsType<OkObjectResult>(await expenses.GetExpenses(2026, 12, "Labor", "OPEX", "Cash", null));

        var expense = Assert.Single(Assert.IsType<List<ExpenseRecordDto>>(november.Value));
        Assert.Empty(Assert.IsType<List<ExpenseRecordDto>>(december.Value));
        Assert.Equal(finalized.Period.SyncedExpenseId, expense.Id);
        Assert.Equal(Sunday.ToDateTime(TimeOnly.MinValue), expense.ExpenseDate);
        Assert.Equal(3000m, expense.TotalCost);
        Assert.Equal("Labor", expense.Category);
        Assert.Equal("OPEX", expense.CostType);
        Assert.Equal("Cash", expense.PaymentMethod);
        Assert.Equal(1m, expense.Quantity);
        Assert.Equal("payroll period", expense.Unit);
        Assert.Equal(3000m, expense.UnitCost);
        Assert.Equal(Owner, expense.EncodedBy);
        Assert.True(expense.IsPayrollSynced);
    }

    [Fact]
    public async Task ExpenseSyncEndpointRejectsDraftsAndPostsAFinalizedPeriodOnlyOnce()
    {
        await using var store = await PayrollServiceTests.PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var draft = await PreparePayrollAsync(payroll);
        var controller = new PayrollController(payroll)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new(ClaimTypes.Name, Owner), new(ClaimTypes.Role, "Owner")], "test")),
                },
            },
        };
        Assert.IsType<BadRequestObjectResult>(await controller.SyncPeriodExpense(draft.Period.Id, Ct));
        Assert.Empty(await store.Db.Expenses.ToListAsync(Ct));

        var finalized = await payroll.FinalizePeriodAsync(draft.Period.Id, new(false), Owner, Ct);
        Assert.Null(finalized.Period.SyncedExpenseId);
        var storedPeriod = await store.Db.PayrollPeriods.SingleAsync(Ct);
        storedPeriod.TotalLaborExpense = 0m;
        await store.Db.SaveChangesAsync(Ct);
        store.Db.ChangeTracker.Clear();

        var firstResponse = Assert.IsType<OkObjectResult>(await controller.SyncPeriodExpense(draft.Period.Id, Ct));
        var first = Assert.IsType<PayrollDetailDto>(firstResponse.Value);
        store.Db.ChangeTracker.Clear();
        var secondResponse = Assert.IsType<OkObjectResult>(await controller.SyncPeriodExpense(draft.Period.Id, Ct));
        var second = Assert.IsType<PayrollDetailDto>(secondResponse.Value);

        var expense = Assert.Single(await store.Db.Expenses.ToListAsync(Ct));
        Assert.Equal(expense.Id, first.Period.SyncedExpenseId);
        Assert.Equal(expense.Id, second.Period.SyncedExpenseId);
        Assert.Equal(expense.Id, first.SyncedExpense?.Id);
        Assert.Equal(expense.Id, second.SyncedExpense?.Id);
        Assert.Equal(3000m, first.Period.TotalLaborExpense);
        Assert.Equal(3000m, second.SyncedExpense?.TotalCost);
        Assert.Equal(Sunday.ToDateTime(TimeOnly.MinValue), expense.ExpenseDate);
        Assert.Equal(finalized.Period.FinalizedAt, second.Period.FinalizedAt);
        Assert.Equal(2500m, second.Period.TotalNetPay);
        Assert.Equal(1, await store.Db.CashAdvanceLedger.CountAsync(row => row.Type == CashAdvanceLedger.PayrollDeduction, Ct));
    }

    private static async Task<PayrollDetailDto> PreparePayrollAsync(PayrollService payroll)
    {
        var employee = await payroll.SaveEmployeeAsync(null, new(1, "Payroll Test", "Prep", 600m, null, true), Ct);
        for (var day = 0; day < 5; day++)
        {
            await payroll.AddAttendanceAsync(new(employee.Id, Monday.AddDays(day), new(null, null, 1m, 0m, true, null)), Owner, Ct);
        }
        await payroll.RecordValeAsync(new(employee.Id, Wednesday, CashAdvanceLedger.Disbursement, 500m, null), Owner, Ct);
        return await payroll.PreviewPeriodAsync(new(Monday, Sunday, "Weekly"), Ct);
    }
}
