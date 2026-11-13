using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public interface IExpenseService
{
    Task<List<ExpenseRecordDto>> GetExpensesAsync(
        int year,
        int month,
        string? category,
        string? costType,
        string? paymentMethod,
        string? search);
    Task<ExpenseRecordDto?> GetExpenseAsync(int id);
    Task<ExpenseRecordDto> CreateExpenseAsync(UpsertExpenseRequest request, string encodedBy);
    Task<ExpenseRecordDto> UpdateExpenseAsync(int id, UpsertExpenseRequest request, string encodedBy);
    Task DeleteExpenseAsync(int id);
    Task<ExpenseSummaryDto> GetSummaryAsync(int year, int month, bool includeRevenueAndProfit);
    Task<ExpenseReclassificationResultDto> AutoReclassifyAsync(int year, int month);
}

public sealed class ExpenseService : IExpenseService
{
    private static readonly string[] PaymentMethods = ["Cash", "GCash", "Maya", "Bank Transfer"];
    private readonly LechonDbContext _context;

    public ExpenseService(LechonDbContext context)
    {
        _context = context;
    }

    public async Task<List<ExpenseRecordDto>> GetExpensesAsync(
        int year,
        int month,
        string? category,
        string? costType,
        string? paymentMethod,
        string? search)
    {
        var (start, end) = GetMonthRange(year, month);
        IQueryable<ExpenseRecord> query = _context.Expenses
            .AsNoTracking()
            .Where(expense => expense.ExpenseDate >= start && expense.ExpenseDate < end);

        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalizedCategory = ExpenseCategorizer.NormalizeCategory(category);
            query = query.Where(expense => expense.Category == normalizedCategory);
        }

        if (!string.IsNullOrWhiteSpace(costType) &&
            !string.Equals(costType, "All", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedCostType = NormalizeCostType(costType);
            query = query.Where(expense => expense.CostType == normalizedCostType);
        }

        if (!string.IsNullOrWhiteSpace(paymentMethod) &&
            !string.Equals(paymentMethod, "All", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedPaymentMethod = NormalizePaymentMethod(paymentMethod);
            query = query.Where(expense => expense.PaymentMethod == normalizedPaymentMethod);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(expense =>
                expense.ItemDescription.Contains(term) ||
                (expense.Remarks != null && expense.Remarks.Contains(term)) ||
                expense.EncodedBy.Contains(term));
        }

        var records = await query
            .OrderByDescending(expense => expense.ExpenseDate)
            .ThenByDescending(expense => expense.Id)
            .ToListAsync();
        return records.Select(ToDto).ToList();
    }

    public async Task<ExpenseRecordDto?> GetExpenseAsync(int id)
    {
        var record = await _context.Expenses.AsNoTracking().FirstOrDefaultAsync(expense => expense.Id == id);
        return record == null ? null : ToDto(record);
    }

    public async Task<ExpenseRecordDto> CreateExpenseAsync(UpsertExpenseRequest request, string encodedBy)
    {
        var normalized = NormalizeRequest(request);
        var record = new ExpenseRecord
        {
            ExpenseDate = normalized.ExpenseDate,
            Category = normalized.Category,
            CostType = normalized.CostType,
            ItemDescription = normalized.ItemDescription,
            Quantity = normalized.Quantity,
            Unit = normalized.Unit,
            UnitCost = normalized.UnitCost,
            TotalCost = normalized.TotalCost,
            PaymentMethod = normalized.PaymentMethod,
            Remarks = normalized.Remarks,
            EncodedBy = NormalizeEncodedBy(encodedBy),
            CreatedAt = DateTime.UtcNow
        };

        _context.Expenses.Add(record);
        await _context.SaveChangesAsync();
        return ToDto(record);
    }

    public async Task<ExpenseRecordDto> UpdateExpenseAsync(int id, UpsertExpenseRequest request, string encodedBy)
    {
        var record = await _context.Expenses.FirstOrDefaultAsync(expense => expense.Id == id)
            ?? throw new KeyNotFoundException($"Expense with ID {id} was not found.");
        var normalized = NormalizeRequest(request);

        record.ExpenseDate = normalized.ExpenseDate;
        record.Category = normalized.Category;
        record.CostType = normalized.CostType;
        record.ItemDescription = normalized.ItemDescription;
        record.Quantity = normalized.Quantity;
        record.Unit = normalized.Unit;
        record.UnitCost = normalized.UnitCost;
        record.TotalCost = normalized.TotalCost;
        record.PaymentMethod = normalized.PaymentMethod;
        record.Remarks = normalized.Remarks;
        record.EncodedBy = NormalizeEncodedBy(encodedBy);

        await _context.SaveChangesAsync();
        return ToDto(record);
    }

    public async Task DeleteExpenseAsync(int id)
    {
        var record = await _context.Expenses.FirstOrDefaultAsync(expense => expense.Id == id)
            ?? throw new KeyNotFoundException($"Expense with ID {id} was not found.");
        _context.Expenses.Remove(record);
        await _context.SaveChangesAsync();
    }

    public async Task<ExpenseSummaryDto> GetSummaryAsync(int year, int month, bool includeRevenueAndProfit)
    {
        var (start, end) = GetMonthRange(year, month);
        var yearStart = DateTime.SpecifyKind(new DateTime(year, 1, 1), DateTimeKind.Unspecified);
        var nextYear = yearStart.AddYears(1);

        var monthExpenses = await _context.Expenses
            .AsNoTracking()
            .Where(expense => expense.ExpenseDate >= start && expense.ExpenseDate < end)
            .ToListAsync();
        var totalExpensesYtd = await _context.Expenses
            .AsNoTracking()
            .Where(expense => expense.ExpenseDate >= yearStart &&
                              expense.ExpenseDate < nextYear)
            .SumAsync(expense => (decimal?)expense.TotalCost) ?? 0m;

        var totalDirectCosts = monthExpenses
            .Where(expense => expense.CostType == ExpenseCategorizer.Cogs)
            .Sum(expense => expense.TotalCost);
        var totalOverhead = monthExpenses
            .Where(expense => expense.CostType == ExpenseCategorizer.Opex)
            .Sum(expense => expense.TotalCost);
        var ownerOutflows = monthExpenses
            .Where(expense => expense.CostType == ExpenseCategorizer.NonOperating)
            .Sum(expense => expense.TotalCost);
        var totalOperating = totalDirectCosts + totalOverhead;
        var grandTotal = totalOperating + ownerOutflows;

        var categoryTotals = monthExpenses
            .GroupBy(expense => expense.Category, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Sum(expense => expense.TotalCost), StringComparer.OrdinalIgnoreCase);
        var summary = new ExpenseSummaryDto
        {
            Year = year,
            Month = month,
            TotalExpensesYtd = totalExpensesYtd,
            TotalDirectCosts = totalDirectCosts,
            TotalOverhead = totalOverhead,
            TotalOperatingExpenses = totalOperating,
            OwnerNonOperatingOutflows = ownerOutflows,
            GrandTotalOutflow = grandTotal,
            CategoryBreakdown = ExpenseCategorizer.Categories.Select(category =>
            {
                var total = categoryTotals.GetValueOrDefault(category);
                return new ExpenseCategoryBreakdownDto
                {
                    Category = category,
                    CostType = ExpenseCategorizer.GetCostType(category),
                    TotalCost = total,
                    PercentageShare = grandTotal == 0
                        ? 0
                        : Math.Round(total / grandTotal * 100m, 2, MidpointRounding.AwayFromZero)
                };
            }).ToList()
        };

        // This branch is intentionally skipped for Accountant. Revenue data is not
        // even queried, and all sensitive nullable fields remain null in the payload.
        if (!includeRevenueAndProfit) return summary;

        var orderValues = await _context.Orders
            .AsNoTracking()
            .Where(order => !order.IsDraft &&
                            !order.IsCancelled &&
                            order.TargetDeliveryTime.HasValue &&
                            order.TargetDeliveryTime.Value >= start &&
                            order.TargetDeliveryTime.Value < end)
            .Select(order => new
            {
                order.Price,
                order.DeliveryFee,
                order.Discount,
                order.GrandTotal
            })
            .ToListAsync();

        var grossRevenue = orderValues.Sum(order => order.GrandTotal > 0
            ? order.GrandTotal + Math.Max(0, order.Discount)
            : Math.Max(0, order.Price + order.DeliveryFee));
        var deliveryFeeRevenue = orderValues.Sum(order => Math.Max(0, order.DeliveryFee));
        var discountTotal = orderValues.Sum(order => Math.Max(0, order.Discount));
        var netFoodRevenue = grossRevenue - deliveryFeeRevenue - discountTotal;
        var grossProfit = netFoodRevenue - totalDirectCosts;
        var operatingNetProfit = grossProfit - totalOverhead;

        summary.GrossRevenue = grossRevenue;
        summary.NetFoodRevenue = netFoodRevenue;
        summary.DeliveryFeeRevenue = deliveryFeeRevenue;
        summary.DiscountTotal = discountTotal;
        summary.GrossProfit = grossProfit;
        summary.OperatingNetProfit = operatingNetProfit;
        summary.NetCashFlowAfterOwnerOutflows = operatingNetProfit - ownerOutflows;
        return summary;
    }

    public async Task<ExpenseReclassificationResultDto> AutoReclassifyAsync(int year, int month)
    {
        var (start, end) = GetMonthRange(year, month);
        var records = await _context.Expenses
            .Where(expense => expense.ExpenseDate >= start && expense.ExpenseDate < end)
            .ToListAsync();
        var updated = new List<ExpenseRecord>();

        foreach (var record in records)
        {
            var classification = ExpenseCategorizer.TryClassify(record.ItemDescription);
            if (classification == null ||
                (record.Category == classification.Category && record.CostType == classification.CostType))
            {
                continue;
            }

            record.Category = classification.Category;
            record.CostType = classification.CostType;
            updated.Add(record);
        }

        if (updated.Count > 0) await _context.SaveChangesAsync();

        return new ExpenseReclassificationResultDto
        {
            InspectedCount = records.Count,
            UpdatedCount = updated.Count,
            UpdatedRecords = updated.Select(ToDto).ToList()
        };
    }

    private static ExpenseRecordDto ToDto(ExpenseRecord record)
    {
        var computedUnitCost = record.UnitCost;
        if (!computedUnitCost.HasValue && record.Quantity is > 0)
        {
            computedUnitCost = Math.Round(record.TotalCost / record.Quantity.Value, 2, MidpointRounding.AwayFromZero);
        }

        return new ExpenseRecordDto
        {
            Id = record.Id,
            ExpenseDate = DateTime.SpecifyKind(record.ExpenseDate, DateTimeKind.Unspecified),
            Category = record.Category,
            CostType = record.CostType,
            ItemDescription = record.ItemDescription,
            Quantity = record.Quantity,
            Unit = record.Unit,
            UnitCost = record.UnitCost,
            ComputedUnitCost = computedUnitCost,
            TotalCost = record.TotalCost,
            PaymentMethod = record.PaymentMethod,
            Remarks = record.Remarks,
            EncodedBy = record.EncodedBy,
            CreatedAt = record.CreatedAt
        };
    }

    private static NormalizedExpense NormalizeRequest(UpsertExpenseRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.ExpenseDate == default) throw new ArgumentException("Expense date is required.");
        if (string.IsNullOrWhiteSpace(request.ItemDescription)) throw new ArgumentException("Item / description is required.");
        if (request.TotalCost <= 0) throw new ArgumentException("Total cost must be greater than zero.");
        if (request.Quantity.HasValue && request.Quantity <= 0) throw new ArgumentException("Quantity must be greater than zero when provided.");
        if (request.UnitCost.HasValue && request.UnitCost <= 0) throw new ArgumentException("Unit cost must be greater than zero when provided.");

        var description = request.ItemDescription.Trim();
        var category = string.IsNullOrWhiteSpace(request.Category)
            ? ExpenseCategorizer.TryClassify(description)?.Category ?? ExpenseCategorizer.Others
            : ExpenseCategorizer.NormalizeCategory(request.Category);

        return new NormalizedExpense(
            DateTime.SpecifyKind(request.ExpenseDate.Date, DateTimeKind.Unspecified),
            category,
            ExpenseCategorizer.GetCostType(category),
            description,
            request.Quantity,
            NullIfWhiteSpace(request.Unit),
            request.UnitCost,
            request.TotalCost,
            NormalizePaymentMethod(request.PaymentMethod),
            NullIfWhiteSpace(request.Remarks));
    }

    private static (DateTime Start, DateTime End) GetMonthRange(int year, int month)
    {
        if (year is < 2000 or > 2200) throw new ArgumentException("Year must be between 2000 and 2200.");
        if (month is < 1 or > 12) throw new ArgumentException("Month must be between 1 and 12.");
        var start = DateTime.SpecifyKind(new DateTime(year, month, 1), DateTimeKind.Unspecified);
        return (start, start.AddMonths(1));
    }

    private static string NormalizeCostType(string costType)
    {
        var normalized = costType.Trim().ToUpperInvariant();
        if (normalized is not (ExpenseCategorizer.Cogs or ExpenseCategorizer.Opex or ExpenseCategorizer.NonOperating))
        {
            throw new ArgumentException("Cost type must be COGS, OPEX, or NON_OP.");
        }
        return normalized;
    }

    private static string NormalizePaymentMethod(string? paymentMethod)
    {
        var value = paymentMethod?.Trim() ?? string.Empty;
        if (string.Equals(value, "Bank", StringComparison.OrdinalIgnoreCase)) value = "Bank Transfer";
        var normalized = PaymentMethods.FirstOrDefault(method => string.Equals(method, value, StringComparison.OrdinalIgnoreCase));
        return normalized ?? throw new ArgumentException("Payment method must be Cash, GCash, Maya, or Bank Transfer.");
    }

    private static string NormalizeEncodedBy(string encodedBy) =>
        string.IsNullOrWhiteSpace(encodedBy) ? "System" : encodedBy.Trim();

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record NormalizedExpense(
        DateTime ExpenseDate,
        string Category,
        string CostType,
        string ItemDescription,
        decimal? Quantity,
        string? Unit,
        decimal? UnitCost,
        decimal TotalCost,
        string PaymentMethod,
        string? Remarks);
}
