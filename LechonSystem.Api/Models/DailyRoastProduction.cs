using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(ProductionDate), IsUnique = true)]
public class DailyRoastProduction : BaseEntity
{
    public int Id { get; set; }
    public DateOnly ProductionDate { get; set; }
    public int WholeLechonCount { get; set; }
    public int BellyCount { get; set; }
    public int BelliesPerWholeSnapshot { get; set; }
    public int QuotaSnapshot { get; set; }
    [Precision(18, 2)] public decimal BonusPerExcessSnapshot { get; set; }
    public int EquivalentLechons { get; set; }
    [Precision(18, 2)] public decimal TotalBonusPool { get; set; }
    public bool UsesDualIncentives { get; set; }
    public bool PartihanEnabledSnapshot { get; set; }
    public bool MilestoneBonusEnabledSnapshot { get; set; }
    [Precision(18, 2)] public decimal PartihanRatePerLechonSnapshot { get; set; } = 50m;
    [Precision(18, 2)] public decimal PartihanPool { get; set; }
    public int MilestoneStepSnapshot { get; set; } = 10;
    [Precision(18, 2)] public decimal MilestoneBonusAmountSnapshot { get; set; } = 100m;
    public List<DailyRoastAllocation> Allocations { get; set; } = [];
    public List<DailyRoastTeam> Teams { get; set; } = [];
    [MaxLength(128)] public string? UpdatedBy { get; set; }
}
