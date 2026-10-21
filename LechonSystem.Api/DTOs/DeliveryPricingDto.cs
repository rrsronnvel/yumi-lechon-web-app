namespace LechonSystem.Api.DTOs;

public class DeliveryPricingDto
{
    public decimal BaseFare { get; set; } = 100.00m;
    public decimal RatePerKm { get; set; } = 15.00m;
}
