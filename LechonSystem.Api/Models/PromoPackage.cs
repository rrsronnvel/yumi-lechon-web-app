using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

public class PromoPackage
{
    public int Id { get; set; }

    [Required, MaxLength(100)]
    [Unicode]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    [Unicode]
    public string GroupName { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    [Unicode]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    [Unicode]
    public string? Description { get; set; }

    [Required, MaxLength(50)]
    [Unicode]
    public string SeasonScope { get; set; } = "Regular";

    public decimal DiscountAmount { get; set; }

    [Required]
    [Unicode]
    public string IncludedItemsJson { get; set; } = "{}";

    public bool AllowOnPeakDates { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
