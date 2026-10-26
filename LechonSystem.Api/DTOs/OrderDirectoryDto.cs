namespace LechonSystem.Api.DTOs;

public class OrderDirectoryDto
{
    public int Id { get; set; }
    public string OrderReference { get; set; } = string.Empty;
    public bool IsDraft { get; set; } = false;
    public bool IsTimeTbd { get; set; } = false;
    public string CustomerName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string? EventType { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? Landmark { get; set; }
    public string? Remarks { get; set; }
    public int Fulfillment { get; set; } // 0 = Pickup, 1 = Delivery, 2 = Lalamove
    public string RoutingStatus { get; set; } = string.Empty; // "Unassigned", "Assigned", "Delivered"
    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime? RiderDepartureTime { get; set; }
    public int ItemsCount { get; set; }
    public bool HasRoastItems { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal Downpayment { get; set; }
    public string DownpaymentMethod { get; set; } = "None";
    public string? FreebiesSummary { get; set; }
    public string? FreebiesConfigJson { get; set; }
    public decimal BalanceDue { get; set; }
    public bool IsTrustedCustomer { get; set; }
    public bool IsCancelled { get; set; }
    public string? CancellationReason { get; set; }
    public string CreatedBy { get; set; } = "System";
    public DateTime? UpdatedAt { get; set; }
    public bool HasRecentEdits { get; set; }
    public string SettlementCustodyStatus { get; set; } = "Uncollected"; // "Uncollected", "InStaffDrawer", "Settled"
    public string? RiderName { get; set; }
    public bool IsRemittedToOwner { get; set; }
    public bool IsOwnerConfirmed { get; set; }
    public DateTime? OwnerConfirmedAt { get; set; }
    public string? OwnerConfirmedBy { get; set; }
    public List<PaymentChannelTotalDto> PaymentChannelsSummary { get; set; } = new();
}
