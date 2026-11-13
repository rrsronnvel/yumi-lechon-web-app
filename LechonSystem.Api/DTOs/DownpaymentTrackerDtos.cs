namespace LechonSystem.Api.DTOs;

public class DownpaymentTrackerItemDto
{
    public int OrderId { get; set; }
    public string OrderReference { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string BookingSource { get; set; } = string.Empty;
    public decimal DownpaymentAmount { get; set; }
    public string DownpaymentMethod { get; set; } = "None";
    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime CreatedAt { get; set; }
    public string EncodedBy { get; set; } = string.Empty;
    public bool IsDpRemittedToOwner { get; set; }
    public DateTime? DpRemittedAt { get; set; }
    public string? DpRemittedBy { get; set; }
}
