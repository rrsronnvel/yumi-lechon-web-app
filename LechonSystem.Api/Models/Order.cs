namespace LechonSystem.Api.Models;

public class Order : BaseEntity
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty; // e.g., "Facebook Messenger", "Walk-In"

    // The anchor for our backward scheduling math
    public DateTime TargetDeliveryTime { get; set; }

    // Our human-error prevention check flag
    public bool IsDeliveryDetailsConfirmed { get; set; } = false;

    // Navigation property for the sub-items
    public List<OrderItem> OrderItems { get; set; } = new();

    // Add these inside your existing Order.cs model
    public FulfillmentType Fulfillment { get; set; } = FulfillmentType.Pickup;
    public DeliveryStatus RoutingStatus { get; set; } = DeliveryStatus.Unassigned;

    // The Foreign Key linking this order to a specific trip (nullable because pickups don't have trips)
    public int? DeliveryTripId { get; set; }
    public DeliveryTrip? DeliveryTrip { get; set; }
}