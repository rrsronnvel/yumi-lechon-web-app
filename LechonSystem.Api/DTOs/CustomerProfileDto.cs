namespace LechonSystem.Api.DTOs;

public class CustomerProfileDto
{
    public int Id { get; set; }
    public string ContactNumber { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string? DefaultAddress { get; set; }
    public string? DefaultLandmark { get; set; }
    public string? Preferences { get; set; }
    public string? ComplaintHistory { get; set; }
    public bool IsVip { get; set; }
    public int TotalOrdersCount { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<ActiveCustomerOrderSummaryDto> ActiveUpcomingOrders { get; set; } = new();
}

public class ActiveCustomerOrderSummaryDto
{
    public int OrderId { get; set; }
    public string OrderReference { get; set; } = string.Empty;
    public DateTime? TargetDeliveryTime { get; set; }
    public decimal GrandTotal { get; set; }
    public string ItemsSummary { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
}

public class UpdateCustomerNotesRequest
{
    public string? CustomerName { get; set; }
    public string? FacebookName { get; set; }
    public string? Preferences { get; set; }
    public string? ComplaintHistory { get; set; }
    public bool? IsVip { get; set; }
}
