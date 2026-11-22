namespace LechonSystem.Api.DTOs;

public class DownpaymentTrackerItemDto
{
    public int? PaymentLogId { get; set; }
    public int OrderId { get; set; }
    public string OrderReference { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string BookingSource { get; set; } = string.Empty;

    public decimal DownpaymentAmount { get; set; }
    public decimal Amount { get => DownpaymentAmount; set => DownpaymentAmount = value; }

    public string DownpaymentMethod { get; set; } = "None";
    public string PaymentMethod { get => DownpaymentMethod; set => DownpaymentMethod = value; }

    public DateTime? TargetDeliveryTime { get; set; }
    public DateTime? EventDate { get => TargetDeliveryTime; set => TargetDeliveryTime = value; }

    public bool IsDateTbd { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? ReferenceNumber { get; set; }
    public string EncodedBy { get; set; } = string.Empty;

    public int InstallmentIndex { get; set; } = 1;
    public int InstallmentCount { get; set; } = 1;

    public bool IsDpRemittedToOwner { get; set; }
    public bool IsRemittedToOwner { get => IsDpRemittedToOwner; set => IsDpRemittedToOwner = value; }

    public DateTime? DpRemittedAt { get; set; }
    public DateTime? RemittedAt { get => DpRemittedAt; set => DpRemittedAt = value; }

    public string? DpRemittedBy { get; set; }
    public string? RemittedBy { get => DpRemittedBy; set => DpRemittedBy = value; }
}
