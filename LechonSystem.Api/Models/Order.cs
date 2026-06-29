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

    public DateTime TargetDeliveryTime { get; set; }
    public bool IsDeliveryDetailsConfirmed { get; set; } = false;

    public List<OrderItem> OrderItems { get; set; } = new();

    public FulfillmentType Fulfillment { get; set; } = FulfillmentType.Pickup;
    public DeliveryStatus RoutingStatus { get; set; } = DeliveryStatus.Unassigned;

    public int? DeliveryTripId { get; set; }
    public DeliveryTrip? DeliveryTrip { get; set; }
}