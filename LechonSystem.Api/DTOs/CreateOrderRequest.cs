using System;
using System.Collections.Generic;
using LechonSystem.Api.Models; 

namespace LechonSystem.Api.DTOs
{
    public class CreateOrderRequest
    {
        public bool IsDraft { get; set; } = false;
        public string CustomerName { get; set; } = string.Empty;
        public string? FacebookName { get; set; }
        public string CustomerPhone { get; set; } = string.Empty;
        public string? ContactNumber { get; set; }
        public string Source { get; set; } = string.Empty;
        public string? EventType { get; set; }
        public DateTime? TargetDeliveryTime { get; set; }
        public DateTime? RiderDepartureTime { get; set; }
        
        // -- 🚀 NEW POS FIELDS ADDED HERE --
        public string? Address { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? Landmark { get; set; }
        public string? Remarks { get; set; }
        public decimal Price { get; set; }
        public string? AddOns { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal Downpayment { get; set; }
        public string DownpaymentMethod { get; set; } = "None";
        public string? FreebiesSummary { get; set; }
        public string? FreebiesConfigJson { get; set; }
        public bool IsOwnerConfirmed { get; set; }
        public DateTime? OwnerConfirmedAt { get; set; }
        public string? OwnerConfirmedBy { get; set; }

        public decimal Discount { get; set; }
        public decimal GrandTotal { get; set; }

        public bool IsTrustedCustomer { get; set; }

        public FulfillmentType Fulfillment { get; set; } 

        public List<OrderItemRequest> Items { get; set; } = new();
    }

    public class OrderItemRequest
    {
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
        public decimal Price { get; set; }
    }
}
