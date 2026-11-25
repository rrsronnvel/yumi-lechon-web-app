using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Services;
using Microsoft.EntityFrameworkCore;
using static LechonSystem.Api.Tests.PayrollServiceTests;

namespace LechonSystem.Api.Tests;

public class PayrollPhase21Tests
{
    private const string Owner = "owner-test";
    private static readonly CancellationToken Ct = CancellationToken.None;
    private static readonly DateOnly November28 = new(2026, 11, 28);
    private static readonly DateOnly December24 = new(2026, 12, 24);

    [Fact]
    public async Task November28TeamsPayTheirOwnSharesAndTheStoreMilestonePaysOncePerDay()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var jayson = await AddWorker(payroll, 1, "Jayson", "Leader", milestone: true);
        var ced = await AddWorker(payroll, 2, "Ced", "Assistant");
        var henry = await AddWorker(payroll, 3, "Henry", "Newbie");
        var jaynard = await AddWorker(payroll, 4, "Jaynard", "Leader", milestone: true);
        var gulay = await AddWorker(payroll, 5, "Gulay", "Assistant");
        var jr = await AddWorker(payroll, 6, "Jr", "Newbie");
        var nico = await AddWorker(payroll, 7, "Nico", "None", milestone: true, role: "Prep");
        var absent = await AddWorker(payroll, 8, "Off duty", "Newbie", milestone: true);
        foreach (var worker in new[] { jayson, ced, henry, jaynard, gulay, jr, nico })
            await payroll.AddAttendanceAsync(new(worker.Id, November28, Worked()), Owner, Ct);
        await payroll.AddAttendanceAsync(new(absent.Id, November28, Worked(0m)), Owner, Ct);

        Assert.Equal(new[] { 8m, 5m, 3m }, new[] { jayson.IncentiveWeight, ced.IncentiveWeight, henry.IncentiveWeight });
        var monday = November28.AddDays(-5);
        var tuesday = monday.AddDays(1);
        await payroll.AddAttendanceAsync(new(nico.Id, monday, Worked()), Owner, Ct);
        await payroll.AddAttendanceAsync(new(nico.Id, tuesday, Worked()), Owner, Ct);
        await payroll.SaveRoastProductionAsync([new(monday, 5, 0), new(tuesday, 5, 0), new(November28, 20, 0)], Owner, Ct);
        var jaysonTeam = new RoastTeamInput("Team Jayson", 10, 0, [new(jayson.Id), new(ced.Id), new(henry.Id)]);
        var jaynardTeam = new RoastTeamInput("Team Jaynard", 10, 0, [new(jaynard.Id), new(gulay.Id), new(jr.Id)]);

        var production = await payroll.SaveRoastTeamsAsync(November28, new([jaysonTeam, jaynardTeam]), Owner, Ct);
        Assert.Equal(20, production.EquivalentLechons);
        Assert.Equal(200m, production.MilestonePerPerson);
        Assert.Equal(2, production.Teams.Count);
        AssertTeam(Assert.Single(production.Teams, team => team.TeamName == "Team Jayson"), jayson.Id, ced.Id, henry.Id);
        AssertTeam(Assert.Single(production.Teams, team => team.TeamName == "Team Jaynard"), jaynard.Id, gulay.Id, jr.Id);
        var earlier = await payroll.GetRoastProductionAsync(monday, tuesday, Ct);
        Assert.All(earlier, day => Assert.Equal(0m, day.MilestonePerPerson));
        Assert.DoesNotContain(production.TeamCandidates, employee => employee.EmployeeId == absent.Id);

        store.Db.ChangeTracker.Clear();
        var draft = await payroll.PreviewPeriodAsync(new(monday, November28.AddDays(1), "Weekly"), Ct);
        var paid = draft.Items.ToDictionary(item => item.EmployeeId);
        Assert.Equal(400m, paid[jayson.Id].RoastingIncentivePay);
        Assert.Equal(400m, paid[jaynard.Id].RoastingIncentivePay);
        Assert.Equal(200m, paid[nico.Id].MilestoneIncentivePay);
        Assert.Equal(0m, paid[nico.Id].PartihanIncentivePay);
        Assert.Equal(125m, paid[ced.Id].PartihanIncentivePay);
        Assert.Equal(75m, paid[henry.Id].PartihanIncentivePay);
        Assert.Equal(125m, paid[gulay.Id].PartihanIncentivePay);
        Assert.Equal(75m, paid[jr.Id].PartihanIncentivePay);
        Assert.Equal(0m, paid[absent.Id].RoastingIncentivePay);
        var error = await Assert.ThrowsAsync<ArgumentException>(() => payroll.SaveRoastTeamsAsync(November28,
            new([jaysonTeam with { Members = [.. jaysonTeam.Members, new(absent.Id)] }, jaynardTeam]), Owner, Ct));
        Assert.Equal("Only employees who clocked in on this date can receive daily partihan.", error.Message);
        Assert.Equal(6, await store.Db.DailyRoastTeamMembers.CountAsync(Ct));
    }

    [Fact]
    public async Task TaggedTiktikSplitTheirCutAndManualRoasterSharesSurviveTeamUpdates()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var lead = await AddWorker(payroll, 1, "Lead", "Leader");
        var assistant = await AddWorker(payroll, 2, "Assistant", "Assistant");
        var fullHelper = await AddWorker(payroll, 3, "Full helper", "None", role: "Helper");
        var halfHelper = await AddWorker(payroll, 4, "Half helper", "None", role: "Helper");
        foreach (var worker in new[] { lead, assistant, fullHelper })
            await payroll.AddAttendanceAsync(new(worker.Id, November28, Worked()), Owner, Ct);
        var halfDay = await payroll.AddAttendanceAsync(new(halfHelper.Id, November28, Worked(0.5m)), Owner, Ct);

        var input = new RoastTeamInput("Roasting team", 7, 6,
            [new(lead.Id, AllocatedAmountOverride: 210m), new(assistant.Id), new(fullHelper.Id, "Tiktik"), new(halfHelper.Id, "Tiktik")]);
        var result = await payroll.SaveRoastTeamsAsync(November28, new([input]), Owner, Ct);
        var team = Assert.Single(result.Teams);
        Assert.Equal(10, result.EquivalentLechons);
        Assert.Equal(0m, team.ExternalTiktikAmount);
        Assert.Equal(66.67m, team.Members.Single(member => member.EmployeeId == fullHelper.Id).AllocatedAmount);
        Assert.Equal(33.33m, team.Members.Single(member => member.EmployeeId == halfHelper.Id).AllocatedAmount);
        Assert.Equal(190m, team.Members.Single(member => member.EmployeeId == assistant.Id).AllocatedAmount);

        var edited = await payroll.SaveRoastTeamsAsync(November28, new([input with
        {
            Id = team.Id, TeamName = "Renamed team", TiktikDeductionAmount = 120m,
            Members = [new(lead.Id), new(assistant.Id), new(fullHelper.Id, "Tiktik"), new(halfHelper.Id, "Tiktik")],
        }]), Owner, Ct);
        var saved = Assert.Single(edited.Teams);
        Assert.Equal(team.Id, saved.Id);
        Assert.True(saved.IsTiktikDeductionOverridden);
        Assert.Equal(380m, saved.NetPartihanPool);
        var manual = Assert.Single(saved.Members, member => member.IsManualOverride);
        Assert.Equal(210m, manual.AllocatedAmount);

        await payroll.UpdateAttendanceAsync(halfDay.Id, Worked(0m), Owner, Ct);
        var draft = await payroll.PreviewPeriodAsync(new(November28, November28), Ct);
        Assert.Equal(120m, draft.Items.Single(item => item.EmployeeId == fullHelper.Id).PartihanIncentivePay);
        Assert.Equal(0m, draft.Items.Single(item => item.EmployeeId == halfHelper.Id).PartihanIncentivePay);
        Assert.Equal(210m, draft.Items.Single(item => item.EmployeeId == lead.Id).PartihanIncentivePay);
        Assert.Equal(170m, draft.Items.Single(item => item.EmployeeId == assistant.Id).PartihanIncentivePay);

        var fallback = await payroll.SaveRoastTeamsAsync(November28, new([]), Owner, Ct);
        Assert.Empty(fallback.Teams);
        Assert.Equal(500m, fallback.Allocations.Sum(row => row.PartihanAmount));
        Assert.True((await store.Db.DailyRoastTeams.SingleAsync(Ct)).IsSuperseded);
    }

    [Fact]
    public async Task LastTeamsUsesLatestEarlierActiveAssignmentsAndRetainsCopiedTiktikRate()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var lead = await AddWorker(payroll, 1, "Lead", "Leader");
        var helper = await AddWorker(payroll, 2, "Helper", "None", role: "Helper");
        var earlier = November28.AddDays(-2);
        var superseded = November28.AddDays(-1);
        await payroll.AddAttendanceAsync(new(lead.Id, earlier, Worked()), Owner, Ct);
        await payroll.AddAttendanceAsync(new(helper.Id, earlier, Worked()), Owner, Ct);
        await payroll.AddAttendanceAsync(new(lead.Id, November28, Worked()), Owner, Ct);

        var template = new RoastTeamInput("Team Lead", 5, 0, [new(lead.Id), new(helper.Id, "Tiktik")], TiktikRatePerLechon: 12m);
        await payroll.SaveRoastTeamsAsync(earlier, new([template, new("Removed", 0, 0, [])]), Owner, Ct);
        await payroll.SaveRoastTeamsAsync(earlier, new([template]), Owner, Ct);
        await payroll.SaveRoastTeamsAsync(superseded, new([new("Later removed", 5, 0, [])]), Owner, Ct);
        await payroll.SaveRoastTeamsAsync(superseded, new([]), Owner, Ct);
        await payroll.SaveRoastTeamsAsync(November28, new([new("Current date", 1, 0, [])]), Owner, Ct);

        Assert.Empty((await payroll.GetLastRoastTeamsAsync(earlier, Ct)).Teams);
        var previous = await payroll.GetLastRoastTeamsAsync(November28, Ct);
        Assert.Equal(earlier, previous.ProductionDate);
        var team = Assert.Single(previous.Teams);
        Assert.Equal(template.TeamName, team.TeamName);
        Assert.Equal(12m, team.TiktikRatePerLechon);
        Assert.Equal(new[] { new RoastTeamAssignmentDto(lead.Id, "Roaster"), new RoastTeamAssignmentDto(helper.Id, "Tiktik") }, team.Members);

        var copied = await payroll.SaveRoastTeamsAsync(November28, new([template with
        {
            Members = [new(lead.Id)], TiktikRatePerLechon = team.TiktikRatePerLechon,
        }]), Owner, Ct);
        Assert.Equal(60m, Assert.Single(copied.Teams).TiktikDeductionAmount);
    }

    [Theory]
    [InlineData(10, 0)]
    [InlineData(11, 50)]
    [InlineData(30, 50)]
    [InlineData(31, 100)]
    [InlineData(60, 100)]
    [InlineData(61, 150)]
    public async Task LateDeductionUsesTheInclusiveTierBoundaries(int minutes, int penalty)
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var worker = await AddWorker(payroll, 1, "Scheduled worker", "None");
        var settings = await payroll.GetSettingsAsync(Ct);
        Assert.False(settings.EnableLateDeduction);
        await payroll.SaveSettingsAsync(settings with { EnableLateDeduction = true }, Owner, Ct);

        var start = December24.ToDateTime(new TimeOnly(6, 0));
        var input = Worked() with { TimeIn = start.AddMinutes(minutes), TimeOut = start.AddHours(9), ScheduledStartTime = new(6, 0) };
        var day = await payroll.AddAttendanceAsync(new(worker.Id, December24, input), Owner, Ct);

        Assert.Equal(minutes, day.LateMinutes);
        Assert.Equal(penalty, day.LateDeduction);
        var excused = await payroll.UpdateAttendanceAsync(day.Id, input with { IsLateExcused = true }, Owner, Ct);
        Assert.Equal(0m, excused.LateDeduction);
    }

    [Fact]
    public async Task DeliShiftsReachTheOvertimeGateButOnlyOwnerApprovalProducesPayrollPay()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        await AddWorker(payroll, 1, "Clocked worker", "None");
        var first = December24.AddDays(-3);
        using var raw = DeliBiff8Fixture.Create(first, December24, [
            (21, "06:00\n16:00"), (22, "06:00\n16:30"), (23, "06:00\n17:00"), (24, "06:00\n18:12"),
        ]);
        await payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(raw)], Owner, Ct);
        var rows = (await payroll.GetAttendanceAsync(first, December24, Ct)).Days;
        Assert.Equal(new[] { 10m, 10.5m, 11m, 12.2m }, rows.Select(row => row.TotalHours));
        Assert.Equal(new[] { 0m, 0m, 2m, 3m }, rows.Select(row => row.SuggestedOvertimeHours));
        Assert.Equal(new[] { "None", "None", "Pending", "Pending" }, rows.Select(row => row.OvertimeStatus));
        Assert.All(rows, row => Assert.Equal(0m, row.OvertimePay));
        Assert.Equal(0m, Assert.Single((await payroll.PreviewPeriodAsync(new(first, December24), Ct)).Items).OvertimePay);

        var rejected = await payroll.DecideOvertimeAsync(rows[3].Id, new("Reject"), Owner, Ct);
        Assert.Equal("Rejected", rejected.OvertimeStatus);
        Assert.Equal(0m, rejected.OvertimeHours);
        Assert.Equal(0m, rejected.OvertimePay);
        var approved = await payroll.DecideOvertimeAsync(rows[2].Id, new("Approve"), Owner, Ct);
        Assert.Equal("Approved", approved.OvertimeStatus);
        Assert.Equal(2m, approved.OvertimeHours);
        Assert.Equal(187.50m, approved.OvertimePay);
        Assert.Equal(Owner, approved.OvertimeApprovedBy);
        Assert.NotNull(approved.OvertimeApprovedAt);

        using var reupload = DeliBiff8Fixture.Create(first, December24, [(23, "06:04"), (24, "06:04")]);
        await payroll.ImportAttendanceAsync([DeliBiff8Fixture.AsUpload(reupload)], Owner, Ct);
        store.Db.ChangeTracker.Clear();
        var draft = await payroll.PreviewPeriodAsync(new(first, December24), Ct);
        Assert.Equal(187.50m, Assert.Single(draft.Items).OvertimePay);
        Assert.Equal("Rejected", (await payroll.GetAttendanceAsync(first, December24, Ct)).Days[3].OvertimeStatus);
    }

    [Fact]
    public async Task PeakDayCreditMultipliesBasePayAndLeavesOtherBonusEditable()
    {
        await using var store = await PayrollStore.OpenAsync();
        var payroll = store.Payroll;
        var worker = await AddWorker(payroll, 1, "Peak worker", "None");
        var day = await payroll.AddAttendanceAsync(new(worker.Id, December24, Worked(1.5m)), Owner, Ct);
        var draft = await payroll.PreviewPeriodAsync(new(December24, December24), Ct);
        var item = Assert.Single(draft.Items);
        Assert.Equal(1.5m, day.DayCredit);
        Assert.Equal(1.5m, item.DaysWorked);
        Assert.Equal(900m, item.BasePay);

        var withBonus = await payroll.UpdatePayrollItemAsync(draft.Period.Id, item.Id, new(100m, "Peak bonus", 0m, 0m, null), Ct);
        Assert.Equal(1000m, Assert.Single(withBonus.Items).NetPay);
    }

    private static void AssertTeam(RoastTeamDto team, int leader, int assistant, int newbie)
    {
        Assert.Equal(10, team.EquivalentLechons);
        Assert.Equal(500m, team.GrossPartihanPool);
        Assert.Equal(100m, team.TiktikDeductionAmount);
        Assert.Equal(400m, team.NetPartihanPool);
        Assert.Equal(100m, team.ExternalTiktikAmount);
        var amounts = team.Members.ToDictionary(member => member.EmployeeId, member => member.AllocatedAmount);
        Assert.Equal(200m, amounts[leader]);
        Assert.Equal(125m, amounts[assistant]);
        Assert.Equal(75m, amounts[newbie]);
    }

    private static Task<EmployeeDto> AddWorker(PayrollService payroll, int id, string name, string tier,
        bool milestone = false, string role = "Lechonero") =>
        payroll.SaveEmployeeAsync(null, new(id, name, role, 600m, null, true, tier, HasMilestoneBonus: milestone), Ct);

    private static AttendanceInput Worked(decimal credit = 1m) => new(null, null, credit, null, true, null);
}
