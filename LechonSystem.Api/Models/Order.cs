namespace LechonSystem.Api.Models;

public class Order : BaseEntity
{
    public int Id { get; set; }
    public string OrderReference { get; set; } = string.Empty; // Format: MMDDYY-XXX
    public string CustomerName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string? EventType { get; set; }

    public bool IsDraft { get; set; } = false;

    // THE MISSING FIELDS:
    public string? DeliveryAddress { get; set; }
    public string? Landmark { get; set; }
    public string? Remarks { get; set; }
    // -- MAKE SURE ALL OF THESE ARE HERE --
    public decimal Price { get; set; }
    public string? AddOns { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Downpayment { get; set; }
    public string DownpaymentMethod { get; set; } = "None";

    public string? FreebiesSummary { get; set; }
    public string? FreebiesConfigJson { get; set; }

    public bool IsOwnerConfirmed { get; set; } = true;
    public DateTime? OwnerConfirmedAt { get; set; }
    public string? OwnerConfirmedBy { get; set; }

    public decimal Discount { get; set; }
    public decimal GrandTotal { get; set; }
    public bool IsTrustedCustomer { get; set; } = false;

    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime? RiderDepartureTime { get; set; }
    public bool IsDeliveryDetailsConfirmed { get; set; } = false;

    public bool IsCancelled { get; set; } = false;
    public string? CancellationReason { get; set; }
  
    public bool IsPriceWaived { get; set; } = false;
    public string CreatedBy { get; set; } = "System";

    public List<OrderItem> OrderItems { get; set; } = new();

    public FulfillmentType Fulfillment { get; set; } = FulfillmentType.Pickup;
    public DeliveryStatus RoutingStatus { get; set; } = DeliveryStatus.Unassigned;

    public int? DeliveryTripId { get; set; }
    public DeliveryTrip? DeliveryTrip { get; set; }

    public string SettlementCustodyStatus { get; set; } = "Uncollected"; // "Uncollected" | "InStaffDrawer" | "Settled"
    public string? HeldByStaffMethod { get; set; } // "Cash" | "ManualGCash" | "GCash"
    public string? RiderSignedBy { get; set; }
    public decimal? RiderRemittedAmount { get; set; }
    public DateTime? RiderSignedAt { get; set; }
    public string? StaffValidatedBy { get; set; }
    public DateTime? StaffValidatedAt { get; set; }
    public string? OwnerApprovedBy { get; set; }
    public DateTime? OwnerApprovedAt { get; set; }
}
