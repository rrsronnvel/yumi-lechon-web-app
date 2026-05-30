namespace LechonSystem.Api.Models;

public class ProductCookingProfile : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int ItemCategoryId { get; set; }
    public int TahiDurationMinutes { get; set; }
    public int SalangDurationMinutes { get; set; }
    public int PackagingDurationMinutes { get; set; }
}
