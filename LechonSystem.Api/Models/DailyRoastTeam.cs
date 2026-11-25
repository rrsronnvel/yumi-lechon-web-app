using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

public class DailyRoastTeam : BaseEntity
{
    public int Id { get; set; }
    public int DailyRoastProductionId { get; set; }
    public DailyRoastProduction DailyRoastProduction { get; set; } = null!;
    [MaxLength(80)] public string TeamName { get; set; } = string.Empty;
    public int WholeLechonCount { get; set; }
    public int BellyCount { get; set; }
    public int EquivalentLechons { get; set; }
    [Precision(18, 2)] public decimal GrossPartihanPool { get; set; }
    [Precision(18, 2)] public decimal TiktikRatePerLechonSnapshot { get; set; } = 10m;
    [Precision(18, 2)] public decimal TiktikDeductionAmount { get; set; }
    public bool IsTiktikDeductionOverridden { get; set; }
    [Precision(18, 2)] public decimal NetPartihanPool { get; set; }
    public bool IsSuperseded { get; set; }
    public List<DailyRoastTeamMember> Members { get; set; } = [];
}
