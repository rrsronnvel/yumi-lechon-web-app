using System;
using System.Collections.Generic;
using LechonSystem.Api.Models; // 👈 Make sure to import your Models folder so it knows what FulfillmentType is!

namespace LechonSystem.Api.DTOs
{
    public class CreateOrderRequest
    {
        public string CustomerName { get; set; } = string.Empty;
        public string ContactNumber { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty; 
        public DateTime TargetDeliveryTime { get; set; }
        
        
        public FulfillmentType Fulfillment { get; set; } 

        public List<OrderItemRequest> Items { get; set; } = new();
    }

    public class OrderItemRequest
    {
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
    }
}