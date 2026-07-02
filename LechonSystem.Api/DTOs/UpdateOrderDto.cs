namespace LechonSystem.Api.Models.DTOs
{
    public class UpdateOrderDto
    {
        // 1. The Anchor (Which order are we editing?)
        public int Id { get; set; }

        // 2. Customer & Routing Details
        public string CustomerName { get; set; } = string.Empty;
        public string ContactNumber { get; set; } = string.Empty;
        public string DeliveryAddress { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        public DateTime TargetDeliveryTime { get; set; }
        public FulfillmentType Fulfillment { get; set; }

        // 3. Financials
        public decimal Price { get; set; }
        public string? AddOns { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal Downpayment { get; set; }

        // 4. The Order Items (Needed so we can see if they changed the Lechon Size!)
        public List<UpdateOrderItemDto> Items { get; set; } = new();
    }

    // A small helper class to carry the edited items
    public class UpdateOrderItemDto
    {
        public int Id { get; set; } // The ID of the existing order item (0 if it's a brand new item added during edit)
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
    }
}