using System;
using System.Collections.Generic;

namespace LechonSystem.Api.DTOs;

public class OrderDetailsDto
{
    public int Id { get; set; }
    public string OrderReference { get; set; } = string.Empty;
    public bool IsDraft { get; set; } = false;
    public bool IsTimeTbd { get; set; } = false;
    public string CustomerName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string? EventType { get; set; }
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
    public decimal Discount { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal BalanceDue { get; set; }

    public bool IsTrustedCustomer { get; set; }
    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime? RiderDepartureTime { get; set; }
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

    public int? CustomerProfileId { get; set; }
    public int CustomerTotalOrdersCount { get; set; }
    public string? CustomerPreferences { get; set; }
    public string? CustomerComplaintHistory { get; set; }
    public string SettlementCustodyStatus { get; set; } = "Uncollected"; // "Uncollected", "InStaffDrawer", "Settled"
    public bool IsOwnerConfirmed { get; set; }
    public DateTime? OwnerConfirmedAt { get; set; }
    public string? OwnerConfirmedBy { get; set; }

    public List<OrderDetailItemDto> OrderItems { get; set; } = new();
    public List<PaymentLogDto> PaymentLogs { get; set; } = new();
    public List<PaymentChannelTotalDto> PaymentChannelsSummary { get; set; } = new();
}

public class PaymentLogDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string Status { get; set; } = string.Empty;
    public string GatewayReferenceId { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsVoided { get; set; }
    public DateTime? VoidedAt { get; set; }
    public string? VoidedBy { get; set; }
    public string? VoidReason { get; set; }
}

public class PaymentChannelTotalDto
{
    public string PaymentMethod { get; set; } = "Cash";
    public decimal Amount { get; set; }
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
