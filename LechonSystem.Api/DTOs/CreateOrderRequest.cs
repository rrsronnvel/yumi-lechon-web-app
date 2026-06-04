using System;
using System.Collections.Generic;

namespace LechonSystem.Api.DTOs
{
    public class CreateOrderRequest
    {
        public string CustomerName { get; set; } = string.Empty;
        public string ContactNumber { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty; // e.g., "Messenger", "Walk-in"
        public DateTime TargetDeliveryTime { get; set; }
        
        public List<OrderItemRequest> Items { get; set; } = new();
    }

    public class OrderItemRequest
    {
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
    }
}