namespace LechonSystem.Api.DTOs;

public class PendingPickupSettlementDto
{
    public int OrderId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public DateTime? TargetDeliveryTime { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal Downpayment { get; set; }
    public decimal BalanceDue => Math.Max(0, GrandTotal - Downpayment);
    public bool IsPaidInFull => BalanceDue <= 0;
    public bool IsTrustedCustomer { get; set; }
    public string? Address { get; set; }
    public string? Landmark { get; set; }
    public string? Remarks { get; set; }

    public string CustodyStatus { get; set; } = "Uncollected";
    public string? RiderSignedBy { get; set; }
    public string? HeldByStaffName { get; set; }
    public string? HeldPaymentMethod { get; set; }
}
