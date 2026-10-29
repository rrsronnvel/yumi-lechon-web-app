namespace LechonSystem.Api.DTOs;

public class PendingSettlementDropDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string RiderName { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? FacebookName { get; set; }
    public string Source { get; set; } = string.Empty;
    public bool IsTrustedCustomer { get; set; }
    public string DeliveryAddress { get; set; } = string.Empty;
    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime? RiderDepartureTime { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal RiderDeliveryFee { get; set; }
    public decimal NetRemittance { get; set; }
    public string CustodyStatus { get; set; } = "Uncollected";
    public string? RiderSignedBy { get; set; }
    public string? HeldByStaffName { get; set; }
    public string? HeldPaymentMethod { get; set; }
}
