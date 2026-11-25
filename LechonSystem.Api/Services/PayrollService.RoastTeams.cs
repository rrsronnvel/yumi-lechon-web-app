using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed partial class PayrollService
{
    public async Task<LastRoastTeamsDto> GetLastRoastTeamsAsync(DateOnly beforeDate, CancellationToken ct)
    {
        if (beforeDate == default)
            throw new ArgumentException("Select a production date.");

        var latest = await db.DailyRoastProduction.AsNoTracking()
            .Where(day => day.ProductionDate < beforeDate && day.Teams.Any(team => !team.IsSuperseded))
            .OrderByDescending(day => day.ProductionDate)
            .Select(day => new LastRoastTeamsDto(day.ProductionDate, day.Teams.Where(team => !team.IsSuperseded).OrderBy(team => team.Id)
                .Select(team => new RoastTeamTemplateDto(team.TeamName, team.TiktikRatePerLechonSnapshot,
                    team.Members.Where(member => !member.IsSuperseded).OrderBy(member => member.EmployeeId)
                        .Select(member => new RoastTeamAssignmentDto(member.EmployeeId, member.MemberRole)).ToList())).ToList()))
            .FirstOrDefaultAsync(ct);
        return latest ?? new LastRoastTeamsDto(null, []);
    }

    public Task<RoastProductionDto> SaveRoastTeamsAsync(DateOnly date, RoastTeamsInput input, string actor, CancellationToken ct) => WriteAsync(async () =>
    {
        if (date == default)
            throw new ArgumentException("Select a production date.");
        if (input.Teams is null || input.Teams.Any(team => team is null))
            throw new ArgumentException("Provide a list of roasting teams.");

        var entries = input.Teams.Select(team => (Team: team, Name: CleanText(team.TeamName, 80, "Team name")
            ?? throw new ArgumentException("Enter a name for every roasting team."))).ToList();
        var explicitIds = entries.Where(entry => entry.Team.Id.HasValue).Select(entry => entry.Team.Id!.Value).ToHashSet();
        if (entries.Select(entry => entry.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() != entries.Count ||
            explicitIds.Count != entries.Count(entry => entry.Team.Id.HasValue))
            throw new ArgumentException("Send each roasting team once and use a distinct name for each team.");

        var settings = await GetSettingsAsync(ct);
        var credits = (await GetProductionCreditsAsync(date, date, ct))[date].ToDictionary(credit => credit.EmployeeId);
        var saved = await ProductionInRange(date, date).SingleOrDefaultAsync(ct);
        var day = saved ?? NewProduction(date, settings);
        var stored = day.Teams.ToDictionary(team => team.Id);
        if (explicitIds.Any(id => !stored.ContainsKey(id)))
            throw new ArgumentException("Choose a roasting team that belongs to this production date.");

        foreach (var (entry, _) in entries)
            ValidateTeamInput(entry, credits);

        if (saved is null)
        {
            if (entries.Count == 0)
                return RoastProductionDto(day, credits.Values, settings.TiktikDeductionPerLechon);

            var whole = entries.Sum(entry => (long)entry.Team.WholeLechonCount);
            var bellies = entries.Sum(entry => (long)entry.Team.BellyCount);
            if (whole > int.MaxValue || bellies > int.MaxValue)
                throw new ArgumentException("The store production count is too large.");
            day.WholeLechonCount = (int)whole;
            day.BellyCount = (int)bellies;
            CalculateProductionAmounts(day);
            db.DailyRoastProduction.Add(day);
        }
        else if (entries.Count > 0 && !day.UsesDualIncentives)
        {
            // Adding teams to an older Phase 1 date opts it into the dual incentive policy.
            SnapshotDualPolicy(day, settings);
            CalculateProductionAmounts(day);
        }

        var retained = new HashSet<DailyRoastTeam>();
        var now = DateTime.UtcNow;
        foreach (var (entry, name) in entries)
        {
            var team = entry.Id is { } id ? stored[id] : stored.Values
                .Where(team => !explicitIds.Contains(team.Id) && string.Equals(team.TeamName, name, StringComparison.OrdinalIgnoreCase))
                .OrderBy(team => team.IsSuperseded).ThenByDescending(team => team.Id).FirstOrDefault();
            if (team is null)
            {
                team = new DailyRoastTeam { TiktikRatePerLechonSnapshot = settings.TiktikDeductionPerLechon };
                day.Teams.Add(team);
            }

            team.TeamName = name;
            team.WholeLechonCount = entry.WholeLechonCount;
            team.BellyCount = entry.BellyCount;
            team.TiktikRatePerLechonSnapshot = entry.TiktikRatePerLechon ?? team.TiktikRatePerLechonSnapshot;
            var equivalent = (long)entry.WholeLechonCount + entry.BellyCount / day.BelliesPerWholeSnapshot;
            if (equivalent > int.MaxValue)
                throw new ArgumentException("The team's equivalent lechon count is too large.");
            team.EquivalentLechons = (int)equivalent;
            team.GrossPartihanPool = equivalent * day.PartihanRatePerLechonSnapshot;
            team.TiktikDeductionAmount = entry.TiktikDeductionAmount ?? equivalent * team.TiktikRatePerLechonSnapshot;
            team.IsTiktikDeductionOverridden = entry.TiktikDeductionAmount.HasValue;
            team.NetPartihanPool = Math.Max(0m, team.GrossPartihanPool - team.TiktikDeductionAmount);
            ValidateMoney(team.GrossPartihanPool, "Gross Partihan pool");
            ValidateMoney(team.TiktikDeductionAmount, "Tiktik cut");
            team.IsSuperseded = false;
            team.UpdatedAt = now;

            SaveTeamMembers(team, entry.Members, credits);
            SaveCalculatedTeamAmounts(team, CalculateTeam(team, credits, day.PartihanEnabledSnapshot).Members);
            retained.Add(team);
        }

        foreach (var team in day.Teams.Where(team => !team.IsSuperseded && !retained.Contains(team)))
        {
            team.IsSuperseded = true;
            team.UpdatedAt = now;
        }
        day.UpdatedAt = now;
        day.UpdatedBy = actor;
        await db.SaveChangesAsync(ct);
        return RoastProductionDto(day, credits.Values, settings.TiktikDeductionPerLechon);
    }, ct);

    private static void ValidateTeamInput(RoastTeamInput team, IReadOnlyDictionary<int, ProductionCredit> credits)
    {
        if (team.WholeLechonCount < 0 || team.BellyCount < 0)
            throw new ArgumentException("Enter non-negative whole and belly counts for each team.");
        if (team.TiktikRatePerLechon is { } rate)
            ValidateMoney(rate, "Tiktik rate per lechon");
        if (team.Members is null || team.Members.Any(member => member is null))
            throw new ArgumentException("Provide a member list for each roasting team.");
        if (team.Members.Select(member => member.EmployeeId).Distinct().Count() != team.Members.Count)
            throw new ArgumentException("Assign each employee only once per team.");
        foreach (var member in team.Members)
        {
            if (!credits.ContainsKey(member.EmployeeId))
                throw new ArgumentException("Only employees who clocked in on this date can receive daily partihan.");
            if (member.MemberRole is not (DailyRoastTeamMember.Roaster or DailyRoastTeamMember.Tiktik))
                throw new ArgumentException("Choose Roaster or Tiktik for each team member.");
            if (member.AllocatedAmountOverride is { } amount)
            {
                ValidateMoney(amount, "Manual team share");
                if (member.ResetOverride)
                    throw new ArgumentException("Choose a manual share or reset it to the calculated share.");
            }
        }
    }

    private static void SaveTeamMembers(DailyRoastTeam team, IReadOnlyList<RoastTeamMemberInput> inputs,
        IReadOnlyDictionary<int, ProductionCredit> credits)
    {
        var stored = team.Members.ToDictionary(member => member.EmployeeId);
        var selected = inputs.Select(input => input.EmployeeId).ToHashSet();
        foreach (var member in stored.Values.Where(member => !selected.Contains(member.EmployeeId)))
            member.IsSuperseded = true;

        foreach (var input in inputs)
        {
            var exists = stored.TryGetValue(input.EmployeeId, out var member);
            if (member is null)
            {
                member = new DailyRoastTeamMember { EmployeeId = input.EmployeeId };
                team.Members.Add(member);
            }

            var roleChanged = member.MemberRole != input.MemberRole;
            if (!exists || roleChanged || member.IsSuperseded)
                member.WeightSnapshot = input.MemberRole == DailyRoastTeamMember.Roaster ? credits[input.EmployeeId].SplitWeight : 1m;
            member.MemberRole = input.MemberRole;
            member.IsSuperseded = false;

            if (input.AllocatedAmountOverride is { } amount)
            {
                member.IsManualOverride = true;
                member.AllocatedAmount = amount;
            }
            else if (input.ResetOverride || roleChanged)
            {
                member.IsManualOverride = false;
            }
        }
    }

    private static bool HasRoastTeams(DailyRoastProduction day) => day.Teams.Any(team => !team.IsSuperseded);

    private static List<RoastTeamDto> CalculateTeams(DailyRoastProduction day, IEnumerable<ProductionCredit> eligible)
    {
        var credits = eligible.ToDictionary(credit => credit.EmployeeId);
        return day.Teams.Where(team => !team.IsSuperseded).OrderBy(team => team.Id)
            .Select(team => CalculateTeam(team, credits, day.PartihanEnabledSnapshot)).ToList();
    }

    private static RoastTeamDto CalculateTeam(DailyRoastTeam team, IReadOnlyDictionary<int, ProductionCredit> credits, bool enabled)
    {
        var members = team.Members.Where(member => !member.IsSuperseded).ToList();
        var onDuty = members.Where(member => credits.ContainsKey(member.EmployeeId)).ToList();
        var tiktik = onDuty.Where(member => member.MemberRole == DailyRoastTeamMember.Tiktik).ToList();
        var roasters = onDuty.Where(member => member.MemberRole == DailyRoastTeamMember.Roaster).ToList();
        var shares = new Dictionary<int, decimal>();
        if (enabled)
        {
            Split(team.NetPartihanPool, roasters);
            Split(team.TiktikDeductionAmount, tiktik);
        }

        void Split(decimal pool, List<DailyRoastTeamMember> group)
        {
            // Reserve Owner overrides first, then allocate the remaining amount to automatic shares.
            var overrides = group.Where(member => member.IsManualOverride).ToList();
            var remaining = Math.Max(0m, pool - overrides.Sum(member => member.AllocatedAmount));
            foreach (var member in overrides)
                shares.Add(member.EmployeeId, member.AllocatedAmount);
            foreach (var (employeeId, amount) in SplitWeightedPool(remaining, group.Where(member => !member.IsManualOverride)
                         .Select(member => (member.EmployeeId, member.WeightSnapshot * credits[member.EmployeeId].DayCredit))))
                shares.Add(employeeId, amount);
        }

        var allocations = members.Select(member =>
        {
            var credit = credits.GetValueOrDefault(member.EmployeeId);
            return new RoastTeamMemberDto(member.EmployeeId, credit?.EmployeeName ?? member.Employee.FullName, member.MemberRole,
                credit?.DayCredit ?? 0m, credit?.IncentiveTier ?? member.Employee.IncentiveTier, member.WeightSnapshot,
                shares.GetValueOrDefault(member.EmployeeId), member.IsManualOverride, member.IsManualOverride ? member.AllocatedAmount : null);
        }).OrderBy(member => member.MemberRole).ThenBy(member => member.EmployeeName).ThenBy(member => member.EmployeeId).ToList();

        return new RoastTeamDto(team.Id, team.TeamName, team.WholeLechonCount, team.BellyCount, team.EquivalentLechons,
            team.GrossPartihanPool, team.TiktikDeductionAmount, team.NetPartihanPool,
            enabled && tiktik.Count == 0 ? team.TiktikDeductionAmount : 0m, team.TiktikRatePerLechonSnapshot,
            team.IsTiktikDeductionOverridden, allocations);
    }

    private static void SaveCalculatedTeamAmounts(DailyRoastTeam team, IReadOnlyList<RoastTeamMemberDto> calculations)
    {
        var shares = calculations.ToDictionary(member => member.EmployeeId, member => member.AllocatedAmount);
        foreach (var member in team.Members.Where(member => !member.IsSuperseded && !member.IsManualOverride))
            member.AllocatedAmount = shares[member.EmployeeId];
    }

    private static List<RoastAllocationDto> SummarizeTeamAllocations(DailyRoastProduction day,
        IEnumerable<ProductionCredit> credits, IEnumerable<RoastTeamDto> teams)
    {
        var shares = teams.SelectMany(team => team.Members).Where(member => member.DayCredit > 0m).ToLookup(member => member.EmployeeId);
        var milestone = MilestonePerPerson(day);
        return credits.Where(credit => credit.MilestoneEligible || shares.Contains(credit.EmployeeId)).Select(credit =>
        {
            var teamShares = shares[credit.EmployeeId];
            var partihan = teamShares.Sum(member => member.AllocatedAmount);
            var bonus = credit.MilestoneEligible ? milestone : 0m;
            ValidateMoney(partihan + bonus, "Total incentive");
            return new RoastAllocationDto(credit.EmployeeId, credit.EmployeeName, credit.DayCredit, credit.IncentiveTier,
                Math.Round(credit.EffectiveWeight, 2), partihan, bonus, partihan + bonus, teamShares.Any(member => member.IsManualOverride));
        }).OrderBy(row => row.EmployeeName).ThenBy(row => row.EmployeeId).ToList();
    }
}
