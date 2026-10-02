namespace LechonSystem.Api.DTOs;

public class CategoryMetadataDto
{
    public string Name { get; set; } = string.Empty;
    public decimal MinimumWeightKg { get; set; }
    public decimal MaximumWeightKg { get; set; }
    public int MinimumSafetyStock { get; set; }
}
