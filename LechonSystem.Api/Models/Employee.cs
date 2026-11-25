using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(BiometricUserId), IsUnique = true)]
public class Employee : BaseEntity
{
    public int Id { get; set; }
    public int BiometricUserId { get; set; }
    [MaxLength(120)] public string FullName { get; set; } = string.Empty;
    [MaxLength(24)] public string Role { get; set; } = string.Empty;
    [Precision(18, 2)] public decimal DailyRate { get; set; }
    public bool IsIncentiveEligible { get; set; }
    public bool IsActive { get; set; } = true;
    [MaxLength(12)] public string IncentiveTier { get; set; } = "None";
    public decimal IncentiveWeight { get; set; }
    public bool HasMilestoneBonus { get; set; }
    public TimeOnly? DefaultShiftStartTime { get; set; }
}
