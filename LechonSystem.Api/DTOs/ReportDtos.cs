namespace LechonSystem.Api.DTOs;

public class ReportsAnalyticsDto
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Preset { get; set; } = "This Month";
    public OrderSummaryReportDto OrderSummary { get; set; } = new();
    public List<AdminPerformanceRowDto> AdminPerformance { get; set; } = new();
    public PaymentCollectionReportDto PaymentCollection { get; set; } = new();
}

public class OrderSummaryReportDto
{
    public int TotalOrders { get; set; }
    public int ConfirmedOrders { get; set; }
    public int CompletedOrders { get; set; }
    public int CancelledOrders { get; set; }
    public decimal TotalGrossRevenue { get; set; }
    public decimal AverageOrderValue { get; set; }
    public List<LechonSizeBreakdownDto> LechonSizes { get; set; } = new();
}

public class LechonSizeBreakdownDto
{
    public string Size { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Revenue { get; set; }
}

public class AdminPerformanceRowDto
{
    public string AdminName { get; set; } = string.Empty;
    public int TotalOrdersAssisted { get; set; }
    public decimal TotalSalesGenerated { get; set; }
    public int CompletedOrdersCount { get; set; }
}

public class PaymentCollectionReportDto
{
    public decimal TotalGrossSales { get; set; }
    public decimal TotalDownpaymentCollected { get; set; }
    public decimal TotalCollectedAtHandover { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal TotalOutstandingBalance { get; set; }
    public PaymentChannelBreakdownDto PaymentChannels { get; set; } = new();
}

public class PaymentChannelBreakdownDto
{
    public decimal Cash { get; set; }
    public decimal GCash { get; set; }
    public decimal Maya { get; set; }
    public decimal BankTransfer { get; set; }
}
