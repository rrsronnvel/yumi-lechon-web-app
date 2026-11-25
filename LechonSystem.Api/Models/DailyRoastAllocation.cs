using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(DailyRoastProductionId), nameof(EmployeeId), IsUnique = true)]
public class DailyRoastAllocation
{
    public int Id { get; set; }
    public int DailyRoastProductionId { get; set; }
    public DailyRoastProduction DailyRoastProduction { get; set; } = null!;
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    [MaxLength(12)] public string TierSnapshot { get; set; } = "None";
    public decimal WeightSnapshot { get; set; }
    [Precision(18, 2)] public decimal PartihanAmount { get; set; }
    [Precision(18, 2)] public decimal MilestoneBonusAmount { get; set; }
    [Precision(18, 2)] public decimal TotalIncentiveAmount { get; set; }
    public bool IsManualOverride { get; set; }
    public bool IsSuperseded { get; set; }
}
