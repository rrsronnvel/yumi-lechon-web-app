using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(EmployeeId), nameof(WorkDate), IsUnique = true)]
[Index(nameof(WorkDate))]
public class AttendanceDay : BaseEntity
{
    public const string NoOvertime = "None";
    public const string OvertimePending = "Pending";
    public const string OvertimeApproved = "Approved";
    public const string OvertimeRejected = "Rejected";

    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public DateOnly WorkDate { get; set; }
    public DateTime? TimeIn { get; set; }
    public DateTime? TimeOut { get; set; }
    [Precision(6, 2)] public decimal TotalHours { get; set; }
    [Precision(4, 2)] public decimal DayCredit { get; set; }
    [Precision(18, 2)] public decimal OvertimePay { get; set; }
    public decimal OvertimeHours { get; set; }
    public bool IsOvertimePayOverridden { get; set; }
    public decimal SuggestedOvertimeHours { get; set; }
    [MaxLength(20)] public string OvertimeStatus { get; set; } = NoOvertime;
    [MaxLength(120)] public string? OvertimeApprovedBy { get; set; }
    public DateTime? OvertimeApprovedAt { get; set; }
    [Precision(18, 2)] public decimal? PendingOvertimePayOverride { get; set; }
    [MaxLength(16)] public string DayType { get; set; } = "Regular";
    [MaxLength(16)] public string? DayTypeOverride { get; set; }
    [Precision(18, 2)] public decimal HolidayPremiumPay { get; set; }
    public TimeOnly? ScheduledStartTime { get; set; }
    public int LateMinutes { get; set; }
    [Precision(18, 2)] public decimal LateDeduction { get; set; }
    public bool IsLateExcused { get; set; }
    public bool IsOvernightShift { get; set; }
    [MaxLength(24)] public string ExceptionFlag { get; set; } = "None";
    public bool IsReviewed { get; set; }
    public bool IsManuallyOverridden { get; set; }
    public bool IsSuperseded { get; set; }
    [MaxLength(1000)] public string? Notes { get; set; }
    [MaxLength(128)] public string? UpdatedBy { get; set; }
}
