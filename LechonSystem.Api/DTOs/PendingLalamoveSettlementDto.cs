namespace LechonSystem.Api.DTOs;

public class PendingLalamoveSettlementDto
{
    public int Id => OrderId;
    public int OrderId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string Source { get; set; } = string.Empty;
    public bool IsTrustedCustomer { get; set; }
    public string ContactNumber { get; set; } = string.Empty;
    public string? DeliveryAddress { get; set; }
    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime? RiderDepartureTime { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal Downpayment { get; set; }
    public decimal BalanceDue => Math.Max(0, GrandTotal - Downpayment);
    public bool IsClearedForRelease => BalanceDue <= 0;
    public bool IsReleased { get; set; }
    public string? Remarks { get; set; }
}
