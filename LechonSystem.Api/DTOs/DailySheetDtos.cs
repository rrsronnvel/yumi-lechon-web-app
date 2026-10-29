using System;
using System.Collections.Generic;

namespace LechonSystem.Api.DTOs;

public class DailySheetsResponseDto
{
    public string TargetDate { get; set; } = string.Empty;
    public string FormattedDate { get; set; } = string.Empty;
    public List<DailySheetItemDto> Items { get; set; } = new();
}

public class DailySheetItemDto
{
    public int Id { get; set; }
    public int OrderItemId { get; set; }
    public int OrderId { get; set; }
    public string OrderReference { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string? EventType { get; set; }
    public string? Landmark { get; set; }
    public string Size { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string Weight { get; set; } = string.Empty;
    public string WeightRange { get; set; } = string.Empty;
    public decimal MinWeight { get; set; }
    public decimal MaxWeight { get; set; }
    public decimal MinimumWeightKg { get; set; }
    public decimal MaximumWeightKg { get; set; }
    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime? RiderDepartureTime { get; set; }
    public DateTime? TahiStartTime { get; set; }
    public DateTime? SalangStartTime { get; set; }
    public DateTime? PackagingStartTime { get; set; }
    public int? Priority { get; set; }
    public string Location { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public string? FreebiesSummary { get; set; }
    public string? FreebiesConfigJson { get; set; }
    public string AddOns { get; set; } = "-";
    public decimal Price { get; set; }
    public decimal LechonPrice { get; set; }
    public decimal AddOnsTotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Downpayment { get; set; }
    public string DownpaymentMethod { get; set; } = "None";
    public decimal GrandTotal { get; set; }
    public decimal TotalToCollect { get; set; }
    public bool IsOwnerConfirmed { get; set; }
    public DateTime? OwnerConfirmedAt { get; set; }
    public string? OwnerConfirmedBy { get; set; }
    public int Fulfillment { get; set; }
    public int Quantity { get; set; }
    public string RiderName { get; set; } = "Unassigned";
    public string Status { get; set; } = string.Empty;
    public bool IsManualOverride { get; set; }
}
