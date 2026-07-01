using System;
using System.Collections.Generic;
using LechonSystem.Api.Models; 

namespace LechonSystem.Api.DTOs
{
    public class CreateOrderRequest
    {
        public string CustomerName { get; set; } = string.Empty;
        public string ContactNumber { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty; 
        public DateTime TargetDeliveryTime { get; set; }
        
        // -- 🚀 NEW POS FIELDS ADDED HERE --
        public string DeliveryAddress { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        public decimal Price { get; set; }
        public string? AddOns { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal Downpayment { get; set; }

        public bool IsTrustedCustomer { get; set; }

        public FulfillmentType Fulfillment { get; set; } 

        public List<OrderItemRequest> Items { get; set; } = new();
    }

    public class OrderItemRequest
    {
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
    }
}