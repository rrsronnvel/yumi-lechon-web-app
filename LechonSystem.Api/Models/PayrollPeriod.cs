using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(StartDate), nameof(EndDate), IsUnique = true)]
public class PayrollPeriod : BaseEntity
{
    public const string Draft = "Draft";
    public const string Finalized = "Finalized";

    public int Id { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateOnly PayDate { get; set; }
    [MaxLength(16)] public string CycleType { get; set; } = "Weekly";
    [Precision(18, 2)] public decimal TotalLaborExpense { get; set; }
    public int? SyncedExpenseId { get; set; }
    public ExpenseRecord? SyncedExpense { get; set; }
    [MaxLength(16)] public string Status { get; set; } = Draft;
    [Precision(18, 2)] public decimal TotalNetPay { get; set; }
    [MaxLength(128)] public string? FinalizedBy { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public List<PayrollItem> Items { get; set; } = [];
}
