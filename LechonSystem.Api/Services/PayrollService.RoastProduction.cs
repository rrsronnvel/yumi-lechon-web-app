using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed partial class PayrollService
{
    public async Task<IReadOnlyList<RoastProductionDto>> GetRoastProductionAsync(DateOnly startDate, DateOnly endDate, CancellationToken ct)
    {
        ValidateRange(startDate, endDate);
        var settings = await GetSettingsAsync(ct);
        var saved = await ProductionInRange(startDate, endDate).AsNoTracking().ToDictionaryAsync(day => day.ProductionDate, ct);
        var roster = await GetProductionCreditsAsync(startDate, endDate, ct);

        return RangeDays(startDate, endDate).Select(date =>
        {
            var day = saved.GetValueOrDefault(date) ?? NewProduction(date, settings);
            return RoastProductionDto(day, roster[date], settings.TiktikDeductionPerLechon);
        }).ToList();
    }

    public Task<IReadOnlyList<RoastProductionDto>> SaveRoastProductionAsync(IReadOnlyList<RoastCountInput> inputs, string actor,
        CancellationToken ct) => WriteAsync<IReadOnlyList<RoastProductionDto>>(async () =>
    {
        if (inputs.Count == 0 || inputs.Select(input => input.ProductionDate).Distinct().Count() != inputs.Count)
            throw new ArgumentException("Provide one set of production counts per date.");

        var startDate = inputs.Min(input => input.ProductionDate);
        var endDate = inputs.Max(input => input.ProductionDate);
        ValidateRange(startDate, endDate);
        var settings = await GetSettingsAsync(ct);
        var saved = await ProductionInRange(startDate, endDate)
            .ToDictionaryAsync(row => row.ProductionDate, ct);
        var roster = await GetProductionCreditsAsync(startDate, endDate, ct);
        var updated = new List<DailyRoastProduction>();
        foreach (var entry in inputs)
        {
            if (entry.WholeLechonCount < 0 || entry.BellyCount < 0)
                throw new ArgumentException("Roasting production counts must be non-negative whole numbers.");

            if (!saved.TryGetValue(entry.ProductionDate, out var day))
            {
                day = NewProduction(entry.ProductionDate, settings);
                db.DailyRoastProduction.Add(day);
            }

            day.WholeLechonCount = entry.WholeLechonCount;
            day.BellyCount = entry.BellyCount;
            CalculateProductionAmounts(day);
            day.UpdatedBy = actor;
            day.UpdatedAt = DateTime.UtcNow;
            if (!HasRoastTeams(day))
                SaveCalculatedAllocations(day, CalculateAllocations(day, roster[day.ProductionDate]));
            updated.Add(day);
        }

        await db.SaveChangesAsync(ct);
        return updated.OrderBy(day => day.ProductionDate)
            .Select(day => RoastProductionDto(day, roster[day.ProductionDate], settings.TiktikDeductionPerLechon)).ToList();
    }, ct);

    public Task<RoastProductionDto> SaveRoastAllocationsAsync(DateOnly date, RoastAllocationsInput input, string actor,
        CancellationToken ct) => WriteAsync(async () =>
    {
        if (date == default)
            throw new ArgumentException("Select a production date.");
        var day = await ProductionInRange(date, date).SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Save production counts for this date before editing its allocations.");
        if (HasRoastTeams(day))
            throw new PayrollConflictException("Use Manage Teams / Partihan to change payouts on this date.");
        var roster = (await GetProductionCreditsAsync(date, date, ct))[date];
        var settings = await GetSettingsAsync(ct);
        var edits = input.Allocations;
        IEnumerable<RoastAllocationDto> allocations;
        if (input.Reset)
        {
            if (edits.Count != 0)
                throw new ArgumentException("Send no individual allocations when resetting the date.");
            SnapshotDualPolicy(day, settings);
            foreach (var stored in day.Allocations)
                stored.IsManualOverride = false;
            CalculateProductionAmounts(day);
            allocations = CalculateAllocations(day, roster);
        }
        else
        {
            if (!day.UsesDualIncentives)
                throw new PayrollConflictException("Recalculate this date with the dual incentive policy before editing allocations.");
            if (edits.Count == 0 || edits.Select(edit => edit.EmployeeId).Distinct().Count() != edits.Count)
                throw new ArgumentException("Provide one allocation per employee.");

            var available = CalculateAllocations(day, roster).ToDictionary(row => row.EmployeeId);
            foreach (var edit in edits)
            {
                if (!available.TryGetValue(edit.EmployeeId, out var current))
                    throw new ArgumentException("Choose a roaster assigned an allocation on this production date.");
                ValidateMoney(edit.PartihanAmount, "Partihan amount");
                ValidateMoney(edit.MilestoneBonusAmount, "Milestone bonus");
                var total = edit.PartihanAmount + edit.MilestoneBonusAmount;
                ValidateMoney(total, "Total incentive");
                available[edit.EmployeeId] = current with
                {
                    PartihanAmount = edit.PartihanAmount, MilestoneBonusAmount = edit.MilestoneBonusAmount,
                    TotalIncentiveAmount = total, IsManualOverride = true,
                };
            }
            allocations = available.Values;
        }

        day.UpdatedBy = actor;
        day.UpdatedAt = DateTime.UtcNow;
        SaveCalculatedAllocations(day, allocations);
        await db.SaveChangesAsync(ct);
        return RoastProductionDto(day, roster, settings.TiktikDeductionPerLechon);
    }, ct);

    public async Task<IReadOnlyList<RoastCountInput>> PrefillRoastProductionAsync(DateOnly startDate, DateOnly endDate, CancellationToken ct)
    {
        ValidateRange(startDate, endDate);
        var first = startDate.ToDateTime(TimeOnly.MinValue);
        var exclusiveEnd = endDate.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var counts = await (
            from item in db.OrderItems.AsNoTracking()
            join category in db.ItemCategories on (item.FulfilledItemCategoryId ?? item.ItemCategoryId) equals category.Id
            let order = item.Order!
            where !order.IsCancelled && !order.IsDraft && order.TargetDeliveryTime >= first && order.TargetDeliveryTime < exclusiveEnd
                && category.MinimumWeightKg > 0
            group new { item.Quantity, category.MinimumWeightKg } by order.TargetDeliveryTime!.Value.Date into day
            select new
            {
                Date = day.Key,
                Wholes = day.Sum(item => item.MinimumWeightKg >= 13 ? item.Quantity : 0),
                Bellies = day.Sum(item => item.MinimumWeightKg < 13 ? item.Quantity : 0),
            }).ToListAsync(ct);
        var byDate = counts.ToDictionary(day => DateOnly.FromDateTime(day.Date));

        return RangeDays(startDate, endDate).Select(date => new RoastCountInput(date,
            byDate.GetValueOrDefault(date)?.Wholes ?? 0, byDate.GetValueOrDefault(date)?.Bellies ?? 0)).ToList();
    }

    private IQueryable<DailyRoastProduction> ProductionInRange(DateOnly startDate, DateOnly endDate) =>
        db.DailyRoastProduction.Where(row => row.ProductionDate >= startDate && row.ProductionDate <= endDate)
            .Include(day => day.Allocations).ThenInclude(allocation => allocation.Employee)
            .Include(day => day.Teams).ThenInclude(team => team.Members).ThenInclude(member => member.Employee)
            .AsSplitQuery();

    private async Task<ILookup<DateOnly, ProductionCredit>> GetProductionCreditsAsync(DateOnly startDate, DateOnly endDate, CancellationToken ct)
    {
        var eligible = await AttendanceInRange(startDate, endDate).AsNoTracking()
            .Where(day => day.DayCredit > 0m && day.Employee.IsActive)
            .OrderBy(day => day.Employee.FullName).ThenBy(day => day.EmployeeId)
            .Select(day => new ProductionCredit(day.WorkDate, day.EmployeeId, day.Employee.FullName, day.Employee.Role, day.DayCredit,
                day.Employee.IsIncentiveEligible, day.Employee.HasMilestoneBonus, day.Employee.IncentiveTier, day.Employee.IncentiveWeight)).ToListAsync(ct);
        return eligible.ToLookup(credit => credit.WorkDate);
    }

    private static List<RoastShareDto> SplitRoastPool(decimal pool, IEnumerable<ProductionCredit> eligible)
    {
        var credits = eligible.Where(credit => credit.PartihanEligible).ToList();
        var total = credits.Sum(credit => credit.DayCredit);
        return credits.Select(credit => new RoastShareDto(credit.EmployeeId, credit.EmployeeName, credit.DayCredit,
            Math.Round(pool * (credit.DayCredit / total), 2))).ToList();
    }

    private static DailyRoastProduction NewProduction(DateOnly date, PayrollSettingsDto settings)
    {
        var day = new DailyRoastProduction
        {
            ProductionDate = date, QuotaSnapshot = settings.RoastQuota, BonusPerExcessSnapshot = settings.RoastBonusPerExcess,
        };
        SnapshotDualPolicy(day, settings);
        return day;
    }

    private static void SnapshotDualPolicy(DailyRoastProduction day, PayrollSettingsDto settings)
    {
        day.BelliesPerWholeSnapshot = settings.BelliesPerWhole;
        day.UsesDualIncentives = true;
        day.PartihanEnabledSnapshot = settings.EnablePartihan;
        day.PartihanRatePerLechonSnapshot = settings.PartihanRatePerLechon;
        day.MilestoneBonusEnabledSnapshot = settings.EnableMilestoneBonus;
        day.MilestoneStepSnapshot = settings.MilestoneUnitLechons;
        day.MilestoneBonusAmountSnapshot = settings.MilestoneBonusAmount;
    }

    private static void CalculateProductionAmounts(DailyRoastProduction day)
    {
        var equivalent = (long)day.WholeLechonCount + day.BellyCount / day.BelliesPerWholeSnapshot;
        if (equivalent > int.MaxValue)
            throw new ArgumentException("The equivalent lechon count is too large.");
        day.EquivalentLechons = (int)equivalent;
        day.TotalBonusPool = Math.Max(0, equivalent - day.QuotaSnapshot) * day.BonusPerExcessSnapshot;
        day.PartihanPool = day.UsesDualIncentives && day.PartihanEnabledSnapshot ? equivalent * day.PartihanRatePerLechonSnapshot : 0m;
        ValidateMoney(day.TotalBonusPool, "Roasting bonus pool");
        ValidateMoney(day.PartihanPool, "Partihan pool");
        ValidateMoney(MilestonePerPerson(day), "Milestone bonus per roaster");
    }

    private static decimal MilestonePerPerson(DailyRoastProduction day) => day.UsesDualIncentives && day.MilestoneBonusEnabledSnapshot
        ? day.EquivalentLechons / day.MilestoneStepSnapshot * day.MilestoneBonusAmountSnapshot : 0m;

    private static List<RoastAllocationDto> CalculateAllocations(DailyRoastProduction day, IEnumerable<ProductionCredit> eligible)
    {
        if (!day.UsesDualIncentives)
            return [];

        var roster = eligible.Where(credit => credit.PartihanEligible || credit.MilestoneEligible)
            .ToDictionary(credit => credit.EmployeeId);
        var stored = day.Allocations.Where(row => row.IsManualOverride && !row.IsSuperseded)
            .ToDictionary(row => row.EmployeeId);
        var milestone = MilestonePerPerson(day);
        var shares = SplitWeightedPool(day.PartihanPool, roster.Values.Where(credit => credit.PartihanEligible)
            .Select(credit => (credit.EmployeeId, credit.EffectiveWeight)));

        return roster.Keys.Union(stored.Keys).Select(id =>
        {
            var credit = roster.GetValueOrDefault(id);
            if (stored.TryGetValue(id, out var manual))
            {
                return new RoastAllocationDto(id, credit?.EmployeeName ?? manual.Employee.FullName, credit?.DayCredit ?? 0m,
                    manual.TierSnapshot, manual.WeightSnapshot, manual.PartihanAmount, manual.MilestoneBonusAmount,
                    manual.TotalIncentiveAmount, true);
            }

            var earned = credit!;
            var partihan = shares.GetValueOrDefault(id);
            var bonus = earned.MilestoneEligible ? milestone : 0m;
            ValidateMoney(partihan + bonus, "Total incentive");
            return new RoastAllocationDto(id, earned.EmployeeName, earned.DayCredit, earned.IncentiveTier,
                earned.PartihanEligible ? Math.Round(earned.EffectiveWeight, 2) : 0m, partihan, bonus, partihan + bonus, false);
        }).OrderBy(row => row.EmployeeName).ThenBy(row => row.EmployeeId).ToList();
    }

    private static Dictionary<int, decimal> SplitWeightedPool(decimal pool, IEnumerable<(int EmployeeId, decimal Weight)> eligible)
    {
        var weights = eligible.OrderByDescending(member => member.Weight).ThenBy(member => member.EmployeeId).ToList();
        var totalWeight = weights.Sum(member => member.Weight);
        var shares = weights.ToDictionary(member => member.EmployeeId, member => Math.Round(pool * (member.Weight / totalWeight), 2));
        var remainder = pool - shares.Values.Sum();
        foreach (var member in weights)
        {
            if (remainder == 0m)
                break;
            // Use the highest effective weight first. Tiny pools can require a correction across several rounded shares.
            var correction = Math.Max(-shares[member.EmployeeId], remainder);
            shares[member.EmployeeId] += correction;
            remainder -= correction;
        }

        return shares;
    }

    private static void SaveCalculatedAllocations(DailyRoastProduction day, IEnumerable<RoastAllocationDto> calculated)
    {
        var rows = calculated.ToDictionary(item => item.EmployeeId);
        var stored = day.Allocations.ToDictionary(item => item.EmployeeId);
        foreach (var stale in stored.Values.Where(row => !rows.ContainsKey(row.EmployeeId)))
            stale.IsSuperseded = true;
        foreach (var row in rows.Values)
        {
            if (!stored.TryGetValue(row.EmployeeId, out var allocation))
            {
                allocation = new DailyRoastAllocation { EmployeeId = row.EmployeeId };
                day.Allocations.Add(allocation);
            }
            allocation.TierSnapshot = row.IncentiveTier;
            allocation.WeightSnapshot = row.WeightSnapshot;
            allocation.PartihanAmount = row.PartihanAmount;
            allocation.MilestoneBonusAmount = row.MilestoneBonusAmount;
            allocation.TotalIncentiveAmount = row.TotalIncentiveAmount;
            allocation.IsManualOverride = row.IsManualOverride;
            allocation.IsSuperseded = false;
        }
    }

    private async Task<Dictionary<int, (decimal Partihan, decimal Milestone)>> GetPeriodIncentivesAsync(
        DateOnly startDate, DateOnly endDate, CancellationToken ct)
    {
        var productions = await ProductionInRange(startDate, endDate).ToListAsync(ct);
        var roster = await GetProductionCreditsAsync(startDate, endDate, ct);
        var earnings = new Dictionary<int, (decimal Partihan, decimal Milestone)>();

        void Add(int employeeId, decimal partihan, decimal milestone)
        {
            var current = earnings.GetValueOrDefault(employeeId);
            earnings[employeeId] = (current.Partihan + partihan, current.Milestone + milestone);
        }

        foreach (var day in productions)
        {
            var credits = roster[day.ProductionDate];
            if (HasRoastTeams(day))
            {
                var teams = CalculateTeams(day, credits);
                var byId = teams.ToDictionary(team => team.Id);
                foreach (var team in day.Teams.Where(team => !team.IsSuperseded))
                    SaveCalculatedTeamAmounts(team, byId[team.Id].Members);
                foreach (var row in SummarizeTeamAllocations(day, credits, teams))
                    Add(row.EmployeeId, row.PartihanAmount, row.MilestoneBonusAmount);
                continue;
            }

            if (!day.UsesDualIncentives)
            {
                foreach (var row in SplitRoastPool(day.TotalBonusPool, credits))
                    Add(row.EmployeeId, row.Share, 0m);
                continue;
            }

            var allocations = CalculateAllocations(day, credits);
            SaveCalculatedAllocations(day, allocations);
            foreach (var row in allocations)
                Add(row.EmployeeId, row.PartihanAmount, row.MilestoneBonusAmount);
        }
        return earnings;
    }

    private static RoastProductionDto RoastProductionDto(DailyRoastProduction day, IEnumerable<ProductionCredit> eligible, decimal tiktikRate)
    {
        var teams = CalculateTeams(day, eligible);
        return new(day.ProductionDate, day.WholeLechonCount, day.BellyCount, day.BelliesPerWholeSnapshot, day.QuotaSnapshot,
            day.BonusPerExcessSnapshot, day.EquivalentLechons, day.TotalBonusPool, day.Id != 0, SplitRoastPool(day.TotalBonusPool, eligible),
            day.PartihanRatePerLechonSnapshot, day.PartihanPool, day.MilestoneStepSnapshot, day.MilestoneBonusAmountSnapshot,
            MilestonePerPerson(day), day.UsesDualIncentives, day.PartihanEnabledSnapshot, day.MilestoneBonusEnabledSnapshot,
            teams.Count == 0 ? CalculateAllocations(day, eligible) : SummarizeTeamAllocations(day, eligible, teams), teams,
            eligible.Select(credit => new RoastTeamCandidateDto(credit.EmployeeId, credit.EmployeeName, credit.Role, credit.IncentiveTier,
                credit.ConfiguredWeight, credit.DayCredit, credit.MilestoneEligible)).ToList(), tiktikRate);
    }

    private static IEnumerable<DateOnly> RangeDays(DateOnly startDate, DateOnly endDate) =>
        Enumerable.Range(0, endDate.DayNumber - startDate.DayNumber + 1).Select(startDate.AddDays);

    private sealed record ProductionCredit(DateOnly WorkDate, int EmployeeId, string EmployeeName, string Role, decimal DayCredit,
        bool PartihanEligible, bool MilestoneEligible, string IncentiveTier, decimal ConfiguredWeight)
    {
        public decimal SplitWeight => ConfiguredWeight > 0m ? ConfiguredWeight : 1m;
        public decimal EffectiveWeight => SplitWeight * DayCredit;
    }
}
