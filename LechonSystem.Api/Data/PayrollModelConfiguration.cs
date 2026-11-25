using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

internal static class PayrollModelConfiguration
{
    public static void ConfigurePayroll(this ModelBuilder modelBuilder)
    {
        var employee = modelBuilder.Entity<Employee>();
        employee.Property(e => e.IsIncentiveEligible).HasDefaultValue(false);
        employee.Property(e => e.IsActive).HasDefaultValue(true);
        employee.Property(e => e.IncentiveTier).HasDefaultValue("None");
        employee.Property(e => e.IncentiveWeight).HasPrecision(6, 2).HasDefaultValue(0m);
        employee.Property(e => e.HasMilestoneBonus).HasDefaultValue(false);

        modelBuilder.Entity<RawAttendancePunch>()
            .HasOne(p => p.ImportBatch).WithMany().OnDelete(DeleteBehavior.Restrict);

        var attendance = modelBuilder.Entity<AttendanceDay>();
        attendance.HasOne(d => d.Employee).WithMany().OnDelete(DeleteBehavior.Restrict);
        attendance.Property(d => d.TotalHours).HasPrecision(6, 2);
        attendance.Property(d => d.DayCredit).HasPrecision(4, 2);
        attendance.Property(d => d.OvertimePay).HasDefaultValue(0m);
        attendance.Property(d => d.OvertimeHours).HasPrecision(5, 2).HasDefaultValue(0m);
        attendance.Property(d => d.IsOvertimePayOverridden).HasDefaultValue(false);
        attendance.Property(d => d.SuggestedOvertimeHours).HasPrecision(5, 2).HasDefaultValue(0m);
        attendance.Property(d => d.OvertimeStatus).HasDefaultValue(AttendanceDay.NoOvertime);
        attendance.Property(d => d.DayType).HasDefaultValue("Regular");
        attendance.Property(d => d.HolidayPremiumPay).HasDefaultValue(0m);
        attendance.Property(d => d.LateMinutes).HasDefaultValue(0);
        attendance.Property(d => d.LateDeduction).HasDefaultValue(0m);
        attendance.Property(d => d.IsLateExcused).HasDefaultValue(false);
        attendance.Property(d => d.IsOvernightShift).HasDefaultValue(false);
        attendance.Property(d => d.IsReviewed).HasDefaultValue(false);
        attendance.Property(d => d.IsManuallyOverridden).HasDefaultValue(false);
        attendance.Property(d => d.IsSuperseded).HasDefaultValue(false);

        var ledger = modelBuilder.Entity<CashAdvanceLedger>();
        ledger.Property(l => l.IsVoided).HasDefaultValue(false);
        ledger.ToTable(table => table.HasCheckConstraint("CK_CashAdvanceLedger_PositiveAmount", "[Amount] > 0"));
        ledger.HasOne(l => l.Employee).WithMany().OnDelete(DeleteBehavior.Restrict);
        ledger.HasOne(l => l.PayrollPeriod).WithMany().OnDelete(DeleteBehavior.Restrict);
        ledger.HasIndex(l => new { l.PayrollPeriodId, l.EmployeeId }).IsUnique()
            .HasFilter("[PayrollPeriodId] IS NOT NULL");

        var item = modelBuilder.Entity<PayrollItem>();
        item.Property(p => p.DaysWorked).HasPrecision(5, 2);
        item.HasOne(p => p.Employee).WithMany().OnDelete(DeleteBehavior.Restrict);
        item.HasOne(p => p.PayrollPeriod).WithMany(p => p.Items).OnDelete(DeleteBehavior.Restrict);
        item.Property(p => p.HolidayPremiumPay).HasDefaultValue(0m);
        item.Property(p => p.LateDeduction).HasDefaultValue(0m);
        item.Property(p => p.PartihanIncentivePay).HasDefaultValue(0m);
        item.Property(p => p.MilestoneIncentivePay).HasDefaultValue(0m);
        item.Property(p => p.IsValeDeductionManuallyOverridden).HasDefaultValue(false);

        var period = modelBuilder.Entity<PayrollPeriod>();
        period.Property(p => p.CycleType).HasDefaultValue("Weekly");
        period.Property(p => p.TotalLaborExpense).HasDefaultValue(0m);
        period.HasIndex(p => p.SyncedExpenseId).IsUnique().HasFilter("[SyncedExpenseId] IS NOT NULL");
        period.HasOne(p => p.SyncedExpense).WithMany().OnDelete(DeleteBehavior.NoAction);

        var production = modelBuilder.Entity<DailyRoastProduction>();
        production.Property(p => p.UsesDualIncentives).HasDefaultValue(false);
        production.Property(p => p.PartihanEnabledSnapshot).HasDefaultValue(false);
        production.Property(p => p.MilestoneBonusEnabledSnapshot).HasDefaultValue(false);
        production.Property(p => p.PartihanRatePerLechonSnapshot).HasDefaultValue(50m).HasSentinel(50m);
        production.Property(p => p.PartihanPool).HasDefaultValue(0m);
        production.Property(p => p.MilestoneStepSnapshot).HasDefaultValue(10);
        production.Property(p => p.MilestoneBonusAmountSnapshot).HasDefaultValue(100m).HasSentinel(100m);

        var allocation = modelBuilder.Entity<DailyRoastAllocation>();
        allocation.HasOne(a => a.DailyRoastProduction).WithMany(p => p.Allocations).OnDelete(DeleteBehavior.Restrict);
        allocation.HasOne(a => a.Employee).WithMany().OnDelete(DeleteBehavior.Restrict);
        allocation.Property(a => a.WeightSnapshot).HasPrecision(6, 2);
        allocation.Property(a => a.IsManualOverride).HasDefaultValue(false);
        allocation.Property(a => a.IsSuperseded).HasDefaultValue(false);
        modelBuilder.Entity<PayrollHoliday>().Property(h => h.IsActive).HasDefaultValue(true);

        var team = modelBuilder.Entity<DailyRoastTeam>();
        team.HasOne(t => t.DailyRoastProduction).WithMany(p => p.Teams).OnDelete(DeleteBehavior.Restrict);
        team.Property(t => t.TiktikRatePerLechonSnapshot).HasDefaultValue(10m).HasSentinel(10m);
        team.Property(t => t.TiktikDeductionAmount).HasDefaultValue(0m);
        team.Property(t => t.IsTiktikDeductionOverridden).HasDefaultValue(false);
        team.Property(t => t.IsSuperseded).HasDefaultValue(false);

        var teamMember = modelBuilder.Entity<DailyRoastTeamMember>();
        teamMember.HasOne(m => m.DailyRoastTeam).WithMany(t => t.Members).OnDelete(DeleteBehavior.Restrict);
        teamMember.HasOne(m => m.Employee).WithMany().OnDelete(DeleteBehavior.Restrict);
        teamMember.Property(m => m.MemberRole).HasDefaultValue(DailyRoastTeamMember.Roaster);
        teamMember.Property(m => m.WeightSnapshot).HasPrecision(6, 2);
        teamMember.Property(m => m.IsManualOverride).HasDefaultValue(false);
        teamMember.Property(m => m.IsSuperseded).HasDefaultValue(false);
    }
}
