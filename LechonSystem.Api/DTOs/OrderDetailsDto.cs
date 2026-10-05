using System;
using System.Collections.Generic;

namespace LechonSystem.Api.DTOs;

public class OrderDetailsDto
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string DeliveryAddress { get; set; } = string.Empty;
    public string? Remarks { get; set; }

    public decimal Price { get; set; }
    public string? AddOns { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Downpayment { get; set; }
    public decimal Discount { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal BalanceDue { get; set; }

    public bool IsTrustedCustomer { get; set; }
    public DateTime TargetDeliveryTime { get; set; }
    public bool IsDeliveryDetailsConfirmed { get; set; }

    public bool IsCancelled { get; set; }
    public string? CancellationReason { get; set; }
    public bool IsPriceWaived { get; set; }
    public string CreatedBy { get; set; } = "System";
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public int Fulfillment { get; set; } // 0 = Pickup, 1 = Delivery, 2 = Lalamove
    public string RoutingStatus { get; set; } = "Unassigned"; // "Unassigned", "Assigned", "Delivered"

    public int? DeliveryTripId { get; set; }
    public string? AssignedRiderName { get; set; }
    public string? AssignedRiderPhone { get; set; }

    public List<OrderDetailItemDto> OrderItems { get; set; } = new();
}

public class OrderDetailItemDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ItemCategoryId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public decimal TotalPrice { get; set; }
    public OrderDetailCategoryDto? ItemCategory { get; set; }
}

public class OrderDetailCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal BasePrice { get; set; }
    public decimal MinimumWeightKg { get; set; }
    public decimal MaximumWeightKg { get; set; }
}
