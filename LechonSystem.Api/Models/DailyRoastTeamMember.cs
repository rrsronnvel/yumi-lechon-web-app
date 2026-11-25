using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(DailyRoastTeamId), nameof(EmployeeId), IsUnique = true)]
public class DailyRoastTeamMember
{
    public const string Roaster = "Roaster";
    public const string Tiktik = "Tiktik";

    public int Id { get; set; }
    public int DailyRoastTeamId { get; set; }
    public DailyRoastTeam DailyRoastTeam { get; set; } = null!;
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    [MaxLength(12)] public string MemberRole { get; set; } = Roaster;
    public decimal WeightSnapshot { get; set; }
    [Precision(18, 2)] public decimal AllocatedAmount { get; set; }
    public bool IsManualOverride { get; set; }
    public bool IsSuperseded { get; set; }
}
