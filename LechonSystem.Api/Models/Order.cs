namespace LechonSystem.Api.Models;

public class Order : BaseEntity
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;

    // THE MISSING FIELDS:
    public string DeliveryAddress { get; set; } = string.Empty;
    public string? Remarks { get; set; }
    // -- MAKE SURE ALL OF THESE ARE HERE --
    public decimal Price { get; set; }
    public string? AddOns { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Downpayment { get; set; }

    public decimal Discount { get; set; }
    public decimal GrandTotal { get; set; }
    public bool IsTrustedCustomer { get; set; } = false;

    public DateTime TargetDeliveryTime { get; set; }
    public bool IsDeliveryDetailsConfirmed { get; set; } = false;

    public bool IsCancelled { get; set; } = false;

  
    public bool IsPriceWaived { get; set; } = false;

    public List<OrderItem> OrderItems { get; set; } = new();

    public FulfillmentType Fulfillment { get; set; } = FulfillmentType.Pickup;
    public DeliveryStatus RoutingStatus { get; set; } = DeliveryStatus.Unassigned;

    public int? DeliveryTripId { get; set; }
    public DeliveryTrip? DeliveryTrip { get; set; }
}