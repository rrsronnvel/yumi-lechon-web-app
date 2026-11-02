namespace LechonSystem.Api.DTOs;

public class PaymentSplitDto
{
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNumber { get; set; }
}
