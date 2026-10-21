namespace LechonSystem.Api.DTOs;

public class ParsedOrderDraftDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string ContactNumber { get; set; } = string.Empty;
    public DateTime? TargetDeliveryTime { get; set; }
    public int Fulfillment { get; set; } // 0 = Pickup, 1 = Delivery, 2 = Lalamove
    public string? DeliveryAddress { get; set; }
    public string? Landmark { get; set; }
    public string? EventType { get; set; }
    public string? Remarks { get; set; }
    public decimal? DeliveryFee { get; set; }
    public decimal? Downpayment { get; set; }
    public List<ParsedOrderItemDto> Items { get; set; } = new();
}

public class ParsedOrderItemDto
{
    public int ItemCategoryId { get; set; }
    public int Quantity { get; set; }
}
