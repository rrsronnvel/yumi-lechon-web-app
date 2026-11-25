using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(PayrollPeriodId), nameof(EmployeeId), IsUnique = true)]
public class PayrollItem : BaseEntity
{
    public int Id { get; set; }
    public int PayrollPeriodId { get; set; }
    public PayrollPeriod PayrollPeriod { get; set; } = null!;
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    [MaxLength(120)] public string EmployeeNameSnapshot { get; set; } = string.Empty;
    [Precision(5, 2)] public decimal DaysWorked { get; set; }
    [Precision(18, 2)] public decimal DailyRateSnapshot { get; set; }
    [Precision(18, 2)] public decimal BasePay { get; set; }
    [Precision(18, 2)] public decimal OvertimePay { get; set; }
    [Precision(18, 2)] public decimal RoastingIncentivePay { get; set; }
    [Precision(18, 2)] public decimal HolidayPremiumPay { get; set; }
    [Precision(18, 2)] public decimal LateDeduction { get; set; }
    [Precision(18, 2)] public decimal PartihanIncentivePay { get; set; }
    [Precision(18, 2)] public decimal MilestoneIncentivePay { get; set; }
    [Precision(18, 2)] public decimal OtherBonus { get; set; }
    [MaxLength(1000)] public string? OtherBonusRemarks { get; set; }
    [Precision(18, 2)] public decimal ValeBalanceBefore { get; set; }
    [Precision(18, 2)] public decimal ValeDeducted { get; set; }
    public bool IsValeDeductionManuallyOverridden { get; set; }
    [Precision(18, 2)] public decimal ValeBalanceAfter { get; set; }
    [Precision(18, 2)] public decimal OtherDeduction { get; set; }
    [MaxLength(1000)] public string? OtherDeductionRemarks { get; set; }
    [Precision(18, 2)] public decimal NetPay { get; set; }
}
