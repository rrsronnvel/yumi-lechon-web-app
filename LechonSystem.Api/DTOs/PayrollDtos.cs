using System.Text.Json.Serialization;

namespace LechonSystem.Api.DTOs;

public sealed record EmployeeInput(int BiometricUserId, string FullName, string Role, decimal DailyRate,
    bool? IsIncentiveEligible, bool? IsActive, string? IncentiveTier = null, decimal? IncentiveWeight = null,
    bool? HasMilestoneBonus = null)
{
    private TimeOnly? defaultShiftStartTime;

    public TimeOnly? DefaultShiftStartTime
    {
        get => defaultShiftStartTime;
        init
        {
            defaultShiftStartTime = value;
            HasDefaultShiftStartTime = true;
        }
    }

    [JsonIgnore]
    public bool HasDefaultShiftStartTime { get; private set; }
}
public sealed record EmployeeStatusInput(bool IsActive);
public sealed record EmployeeDto(int Id, int BiometricUserId, string FullName, string Role, decimal DailyRate,
    bool IsIncentiveEligible, bool IsActive, decimal UnpaidValeBalance, string IncentiveTier, decimal IncentiveWeight,
    bool HasMilestoneBonus, TimeOnly? DefaultShiftStartTime, decimal? CurrentWeekEarnedSoFar = null, decimal? MaxAllowedValeNow = null);

public sealed record PayrollSettingsDto(int RoastQuota, decimal RoastBonusPerExcess, int BelliesPerWhole,
    string IncentiveSplitMode = "SharedTeam", bool EnablePartihan = true, decimal PartihanRatePerLechon = 50m,
    bool EnableMilestoneBonus = true, int MilestoneUnitLechons = 10, decimal MilestoneBonusAmount = 100m,
    decimal StandardWorkHoursPerDay = 8m, decimal OvertimeMultiplier = 1.25m, bool EnableHolidayPay = false,
    decimal SpecialHolidayMultiplier = 1.30m, decimal RegularHolidayMultiplier = 2.00m, bool EnableLateDeduction = false,
    int LateGraceMinutes = 10, decimal LatePenaltyAmount = 50m, bool EnableValeSystem = true,
    string ValeAllowedDayOfWeek = "Wednesday", bool EnforceValeEarnedCap = true, bool AutoDeductValeOnPayroll = true,
    bool SyncToExpensesOnFinalize = true, decimal TiktikDeductionPerLechon = 10m,
    int LateTier1MaxMinutes = 30, decimal LateTier1Penalty = 50m, int LateTier2MaxMinutes = 60,
    decimal LateTier2Penalty = 100m, decimal LateTier3Penalty = 150m,
    decimal RegularShiftTotalHours = 9m, decimal UnpaidOtBufferHours = 1m, decimal MinHoursForPaidOt = 11m);

public sealed record PayrollDateRange(DateOnly StartDate, DateOnly EndDate, string? CycleType = null);

public sealed record AttendanceInput(DateTime? TimeIn, DateTime? TimeOut, decimal DayCredit,
    decimal? OvertimePay, bool IsReviewed, string? Notes, decimal? OvertimeHours = null,
    TimeOnly? ScheduledStartTime = null, bool? IsLateExcused = null, string? DayType = null,
    bool? IsOvertimePayOverridden = null, bool? UseEmployeeShiftStart = null);
public sealed record ManualAttendanceInput(int EmployeeId, DateOnly WorkDate, AttendanceInput Attendance);
public sealed record OvertimeDecisionInput(string Decision, decimal? OvertimeHours = null,
    decimal? OvertimePayOverride = null, bool UseCalculatedPay = false);
public sealed record AttendanceDayDto(int Id, int EmployeeId, string EmployeeName, DateOnly WorkDate,
    DateTime? TimeIn, DateTime? TimeOut, decimal TotalHours, decimal DayCredit, decimal OvertimePay,
    bool IsOvernightShift, string ExceptionFlag, bool IsReviewed, bool IsManuallyOverridden, string? Notes,
    string? UpdatedBy, decimal OvertimeHours, string DayType, string? DayTypeOverride, decimal HolidayPremiumPay,
    TimeOnly? ScheduledStartTime, int LateMinutes, decimal LateDeduction, bool IsLateExcused,
    bool IsOvertimePayOverridden, decimal DailyRate, decimal SuggestedOvertimeHours, string OvertimeStatus,
    string? OvertimeApprovedBy, DateTime? OvertimeApprovedAt, decimal? PendingOvertimePayOverride);
public sealed record PayrollHolidayDto(DateOnly HolidayDate, string Name, string HolidayType, bool IsActive = true);
public sealed record UnmappedBiometricUserDto(int BiometricUserId, string? BiometricNameSnapshot, int PunchCount);
public sealed record ImportBatchDto(int Id, string FileName, DateOnly PeriodStart, DateOnly PeriodEnd,
    int PunchesImported, int DuplicatesSkipped, int UnmappedUserCount, string ImportedBy, DateTime ImportedAt);
public sealed record AttendanceImportDto(int PunchesImported, int DuplicatesSkipped, IReadOnlyList<ImportBatchDto> Batches,
    IReadOnlyList<UnmappedBiometricUserDto> UnmappedUsers);
public sealed record AttendanceRangeDto(IReadOnlyList<AttendanceDayDto> Days,
    IReadOnlyList<UnmappedBiometricUserDto> UnmappedUsers, IReadOnlyList<ImportBatchDto> RecentImportBatches);

public sealed record RoastCountInput(DateOnly ProductionDate, int WholeLechonCount, int BellyCount);
public sealed record RoastShareDto(int EmployeeId, string EmployeeName, decimal DayCredit, decimal Share);
public sealed record RoastAllocationDto(int EmployeeId, string EmployeeName, decimal DayCredit, string IncentiveTier,
    decimal WeightSnapshot, decimal PartihanAmount, decimal MilestoneBonusAmount, decimal TotalIncentiveAmount, bool IsManualOverride);
public sealed record RoastAllocationInput(int EmployeeId, decimal PartihanAmount, decimal MilestoneBonusAmount);
public sealed record RoastAllocationsInput(IReadOnlyList<RoastAllocationInput> Allocations, bool Reset = false);
public sealed record RoastTeamMemberInput(int EmployeeId, string MemberRole = "Roaster",
    decimal? AllocatedAmountOverride = null, bool ResetOverride = false);
public sealed record RoastTeamInput(string TeamName, int WholeLechonCount, int BellyCount,
    IReadOnlyList<RoastTeamMemberInput> Members, decimal? TiktikDeductionAmount = null, int? Id = null,
    decimal? TiktikRatePerLechon = null);
public sealed record RoastTeamsInput(IReadOnlyList<RoastTeamInput> Teams);
public sealed record RoastTeamAssignmentDto(int EmployeeId, string MemberRole);
public sealed record RoastTeamTemplateDto(string TeamName, decimal TiktikRatePerLechon,
    IReadOnlyList<RoastTeamAssignmentDto> Members);
public sealed record LastRoastTeamsDto(DateOnly? ProductionDate, IReadOnlyList<RoastTeamTemplateDto> Teams);
public sealed record RoastTeamCandidateDto(int EmployeeId, string EmployeeName, string Role,
    string IncentiveTier, decimal IncentiveWeight, decimal DayCredit, bool HasMilestoneBonus);
public sealed record RoastTeamMemberDto(int EmployeeId, string EmployeeName, string MemberRole, decimal DayCredit,
    string IncentiveTier, decimal WeightSnapshot, decimal AllocatedAmount, bool IsManualOverride, decimal? AllocatedAmountOverride);
public sealed record RoastTeamDto(int Id, string TeamName, int WholeLechonCount, int BellyCount, int EquivalentLechons,
    decimal GrossPartihanPool, decimal TiktikDeductionAmount, decimal NetPartihanPool, decimal ExternalTiktikAmount,
    decimal TiktikRatePerLechonSnapshot, bool IsTiktikDeductionOverridden, IReadOnlyList<RoastTeamMemberDto> Members);
public sealed record RoastProductionDto(DateOnly ProductionDate, int WholeLechonCount, int BellyCount,
    int BelliesPerWholeSnapshot, int QuotaSnapshot, decimal BonusPerExcessSnapshot, int EquivalentLechons,
    decimal TotalBonusPool, bool IsSaved, IReadOnlyList<RoastShareDto> Shares, decimal PartihanRatePerLechonSnapshot,
    decimal PartihanPool, int MilestoneStepSnapshot, decimal MilestoneBonusAmountSnapshot, decimal MilestonePerPerson,
    bool UsesDualIncentives, bool PartihanEnabledSnapshot, bool MilestoneBonusEnabledSnapshot,
    IReadOnlyList<RoastAllocationDto> Allocations, IReadOnlyList<RoastTeamDto> Teams,
    IReadOnlyList<RoastTeamCandidateDto> TeamCandidates, decimal TiktikDeductionPerLechon);

public sealed record ValeInput(int EmployeeId, DateOnly TransactionDate, string Type, decimal Amount, string? Remarks,
    bool OverridePolicy = false);
public sealed record ValeEntryDto(int Id, int EmployeeId, string EmployeeName, DateOnly TransactionDate, string Type,
    decimal Amount, int? PayrollPeriodId, string? Remarks, string RecordedBy, bool IsVoided,
    string? VoidedBy, DateTime? VoidedAt, string? VoidReason);
public sealed record ValeSummaryDto(IReadOnlyList<EmployeeDto> Employees, IReadOnlyList<ValeEntryDto> Entries,
    DateOnly AsOf, bool EnableValeSystem, string ValeAllowedDayOfWeek, bool EnforceValeEarnedCap);
public sealed record ValeVoidInput(string? Reason);
public sealed record ValeVoidResultDto(EmployeeDto Employee, ValeEntryDto Entry);

public sealed record PayrollItemInput(decimal OtherBonus, string? OtherBonusRemarks, decimal ValeDeducted,
    decimal OtherDeduction, string? OtherDeductionRemarks, bool? IsValeDeductionManuallyOverridden = null);
public sealed record PayrollItemDto(int Id, int EmployeeId, string EmployeeName, decimal DaysWorked,
    decimal DailyRateSnapshot, decimal BasePay, decimal OvertimePay, decimal RoastingIncentivePay,
    decimal OtherBonus, string? OtherBonusRemarks, decimal ValeBalanceBefore, decimal ValeDeducted,
    decimal ValeBalanceAfter, decimal OtherDeduction, string? OtherDeductionRemarks, decimal NetPay,
    decimal HolidayPremiumPay, decimal LateDeduction, decimal PartihanIncentivePay, decimal MilestoneIncentivePay,
    bool IsValeDeductionManuallyOverridden);
public sealed record PayrollPeriodDto(int Id, DateOnly StartDate, DateOnly EndDate, DateOnly PayDate, string Status,
    decimal TotalNetPay, string? FinalizedBy, DateTime? FinalizedAt, string CycleType, decimal TotalLaborExpense,
    int? SyncedExpenseId);
public sealed record PayrollDetailDto(PayrollPeriodDto Period, IReadOnlyList<PayrollItemDto> Items,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ExpenseRecordDto? SyncedExpense = null);
public sealed record PayrollFinalizeInput(bool? SyncToExpenses = null);
