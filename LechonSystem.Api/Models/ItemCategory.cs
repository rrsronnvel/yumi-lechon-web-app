namespace LechonSystem.Api.Models;

public class ItemCategory : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal MinimumWeightKg { get; set; }
    public decimal MaximumWeightKg { get; set; }
    public decimal BasePrice { get; set; }

    public int MinimumSafetyStock { get; set; }
}
