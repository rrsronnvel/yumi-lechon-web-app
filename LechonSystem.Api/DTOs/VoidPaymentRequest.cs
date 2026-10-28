namespace LechonSystem.Api.DTOs;

public class VoidPaymentRequest
{
    public string Reason { get; set; } = string.Empty;
    public string? VoidedBy { get; set; }
}
