namespace LechonSystem.Api.Models
{
    public enum FulfillmentType
    {
        Pickup,
        Delivery
    }

    public enum DeliveryStatus
    {
        Unassigned,
        Assigned,
        OutForDelivery,
        Delivered,
        Failed
    }
}