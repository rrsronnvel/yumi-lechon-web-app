namespace LechonSystem.Api.DTOs;

public class UpsertExpenseRequest
{
    public DateTime ExpenseDate { get; set; }
    public string? Category { get; set; }
    public string ItemDescription { get; set; } = string.Empty;
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal TotalCost { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}

public class ExpenseRecordDto
{
    public int Id { get; set; }
    public DateTime ExpenseDate { get; set; }
    public string Category { get; set; } = string.Empty;
    public string CostType { get; set; } = string.Empty;
    public string ItemDescription { get; set; } = string.Empty;
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? ComputedUnitCost { get; set; }
    public decimal TotalCost { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string? Remarks { get; set; }
    public string EncodedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class ExpenseCategoryBreakdownDto
{
    public string Category { get; set; } = string.Empty;
    public string CostType { get; set; } = string.Empty;
    public decimal TotalCost { get; set; }
    public decimal PercentageShare { get; set; }
}

public class ExpenseSummaryDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal TotalExpensesYtd { get; set; }
    public decimal TotalDirectCosts { get; set; }
    public decimal TotalOverhead { get; set; }
    public decimal TotalOperatingExpenses { get; set; }
    public decimal OwnerNonOperatingOutflows { get; set; }
    public decimal GrandTotalOutflow { get; set; }
    public List<ExpenseCategoryBreakdownDto> CategoryBreakdown { get; set; } = [];

    // These fields must stay nullable. Accountant responses deliberately emit null
    // values so revenue and profit cannot leak through the API payload.
    public decimal? GrossRevenue { get; set; }
    public decimal? NetFoodRevenue { get; set; }
    public decimal? DeliveryFeeRevenue { get; set; }
    public decimal? DiscountTotal { get; set; }
    public decimal? GrossProfit { get; set; }
    public decimal? OperatingNetProfit { get; set; }
    public decimal? NetCashFlowAfterOwnerOutflows { get; set; }
}

public class ExpenseReclassificationResultDto
{
    public int InspectedCount { get; set; }
    public int UpdatedCount { get; set; }
    public List<ExpenseRecordDto> UpdatedRecords { get; set; } = [];
}
