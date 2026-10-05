namespace LechonSystem.Api.DTOs;

public class OrderDirectoryDto
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string DeliveryAddress { get; set; } = string.Empty;
    public int Fulfillment { get; set; } // 0 = Pickup, 1 = Delivery, 2 = Lalamove
    public string RoutingStatus { get; set; } = string.Empty; // "Unassigned", "Assigned", "Delivered"
    public DateTime TargetDeliveryTime { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal Downpayment { get; set; }
    public decimal BalanceDue { get; set; }
    public bool IsTrustedCustomer { get; set; }
    public bool IsCancelled { get; set; }
    public string? CancellationReason { get; set; }
    public string CreatedBy { get; set; } = "System";
    public DateTime? UpdatedAt { get; set; }
    public bool HasRecentEdits { get; set; }
}