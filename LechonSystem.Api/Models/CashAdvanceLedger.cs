using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(EmployeeId), nameof(TransactionDate))]
public class CashAdvanceLedger
{
    public const string Disbursement = "Disbursement";
    public const string PayrollDeduction = "PayrollDeduction";
    public const string CashRepayment = "CashRepayment";

    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public DateOnly TransactionDate { get; set; }
    [MaxLength(24)] public string Type { get; set; } = string.Empty;
    [Precision(18, 2)] public decimal Amount { get; set; }
    public int? PayrollPeriodId { get; set; }
    public PayrollPeriod? PayrollPeriod { get; set; }
    [MaxLength(1000)] public string? Remarks { get; set; }
    [MaxLength(128)] public string RecordedBy { get; set; } = string.Empty;
    public bool IsVoided { get; set; }
    [MaxLength(120)] public string? VoidedBy { get; set; }
    public DateTime? VoidedAt { get; set; }
    [MaxLength(250)] public string? VoidReason { get; set; }
}
