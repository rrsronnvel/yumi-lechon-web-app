using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LechonSystem.Api.Models;

[Table("Expenses")]
public class ExpenseRecord
{
    public int Id { get; set; }

    public DateTime ExpenseDate { get; set; }

    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(20)]
    public string CostType { get; set; } = string.Empty;

    [MaxLength(250)]
    public string ItemDescription { get; set; } = string.Empty;

    public decimal? Quantity { get; set; }

    [MaxLength(50)]
    public string? Unit { get; set; }

    public decimal? UnitCost { get; set; }

    public decimal TotalCost { get; set; }

    [MaxLength(50)]
    public string PaymentMethod { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Remarks { get; set; }

    [MaxLength(128)]
    public string EncodedBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
