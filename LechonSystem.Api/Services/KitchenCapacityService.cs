using System.Globalization;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed class KitchenCapacityService(LechonDbContext context)
{
    private const string PeakHoliday = "PeakHoliday";
    private const string Weekend = "Weekend";
    private const string Continuous = "Continuous";
    private const int SuggestionDays = 7;

    private static readonly (string Label, int StartHour, int EndHour)[] ContinuousBlocks =
    [
        ("Morning", 0, 10), ("Midday", 10, 14), ("Afternoon", 14, 18), ("Evening", 18, 24)
    ];

    private readonly record struct RoastLoad(long Whole, long Belly)
    {
        public long Pits(int belliesPerPit) => Whole + (Belly + belliesPerPit - 1) / belliesPerPit;

        public static RoastLoad operator +(RoastLoad left, RoastLoad right) =>
            new(left.Whole + right.Whole, left.Belly + right.Belly);

        public static RoastLoad operator -(RoastLoad left, RoastLoad right) =>
            new(left.Whole - right.Whole, left.Belly - right.Belly);
    }

    private sealed record Roast(DateTime Start, DateTime End, RoastLoad Load, DateTime? ManualStart = null)
    {
        public Roast Shift(TimeSpan offset, TimeSpan dateShift, DateTime departure)
        {
            var savedStart = ManualStart + dateShift;
            return this with { Start = ResolveStart(savedStart, departure, Start + offset), End = End + offset };
        }
    }

    private sealed record BookedOrder(DateTime Date, string? BatchCode, DateTime Departure, IReadOnlyList<Roast> Roasts);

    private sealed class KitchenWorkload(
        IReadOnlyList<KitchenBatchPreset> presets, List<BookedOrder> bookedOrders)
    {
        public IReadOnlyList<KitchenBatchPreset> Presets { get; } = presets;
        public IReadOnlyList<BookedOrder> Orders { get; } = bookedOrders;
        public IReadOnlyList<Roast> Timeline { get; } = bookedOrders.SelectMany(order => order.Roasts).ToList();

        public List<KitchenBatchPreset> Batches(DateTime date) =>
            Presets.Where(batch => batch.ScheduleType == ModeFor(date)).ToList();

        public RoastLoad LoadForBatch(DateTime date, KitchenBatchPreset batch, List<KitchenBatchPreset> batches) =>
            Orders.Where(order => order.Date == date
                                  && FindBatch(batches, order.BatchCode, order.Departure, historical: true)?.Id == batch.Id)
                .SelectMany(order => order.Roasts)
                .Aggregate(new RoastLoad(), (total, roast) => total + roast.Load);
    }

    public async Task<KitchenCapacityDay> GetDayAsync(DateOnly date, string? branchCode, CancellationToken cancellationToken)
    {
        var day = ValidateDate(date);
        var (branch, activeBranches) = await GetBranchAsync(branchCode, cancellationToken);
        var workload = await LoadWorkloadAsync(branch, day, day, null, cancellationToken);
        var mode = ModeFor(day);
        var batches = workload.Batches(day);
        var loads = batches.Select(batch => MakeLoad(batch.BatchCode, batch.Label, batch.StartTime, batch.EndTime,
            batch.AnchorTime, workload.LoadForBatch(day, batch, batches), BatchLimit(branch, batch), branch)).ToList();
        var blocks = new List<KitchenCapacityLoad>();
        if (mode == Continuous)
        {
            foreach (var (label, start, end) in ContinuousBlocks)
            {
                var load = PeakLoad(workload.Timeline, day.AddHours(start), day.AddHours(end), branch.SafeBelliesPerPit);
                blocks.Add(MakeLoad(label.ToUpperInvariant(), label, TimeSpan.FromHours(start),
                    end == 24 ? new TimeSpan(23, 59, 59) : TimeSpan.FromHours(end),
                    TimeSpan.FromHours(start), load, branch.TotalPits, branch));
            }
        }

        var peak = blocks.Concat(loads).Select(load => load.UsedPits).DefaultIfEmpty().Max();
        return new(date, mode, IsHalfDay(day), branch, activeBranches, loads, blocks, peak);
    }

    public Task<KitchenCapacityEvaluation> EvaluateAsync(
        KitchenCapacityRequest request, CancellationToken cancellationToken)
    {
        var date = ValidateDate(request.Date);
        var target = ParseLocalTime(request.TargetTime, date);
        if (target.Date != date)
            throw new ArgumentException("The target time must be on the selected event date.");
        var departure = string.IsNullOrWhiteSpace(request.RiderDepartureTime)
            ? null
            : (DateTime?)ParseLocalTime(request.RiderDepartureTime, date);
        return EvaluateAsync(target, departure, request.Fulfillment, request.BranchCode, request.BatchCode,
            request.Items, request.ExcludeOrderId, cancellationToken);
    }

    public async Task<KitchenCapacityEvaluation> EvaluateAsync(
        DateTime target, DateTime? requestedDeparture, FulfillmentType fulfillment, string? branchCode,
        string? batchCode, IReadOnlyList<KitchenCapacityItem> items, int? excludeOrderId,
        CancellationToken cancellationToken = default)
    {
        var departure = OrderService.ResolveDepartureTime(target, requestedDeparture, fulfillment);
        var day = KitchenDate(target, departure, fulfillment);
        var (branch, _) = await GetBranchAsync(branchCode, cancellationToken);
        var products = await LoadProductsAsync(items.Select(CategoryId), cancellationToken);
        var previousOrder = await LoadPreviousOrderAsync(excludeOrderId, cancellationToken);
        var incoming = BuildIncomingRoasts(items, products, previousOrder, target, departure, fulfillment, branch);
        var workload = await LoadWorkloadAsync(branch, day, day, excludeOrderId, cancellationToken);
        var batches = workload.Batches(day);
        var batch = FindBatch(batches, batchCode, departure);
        if (incoming.Count > 0 && ModeFor(day) != Continuous && batch is null)
            throw new ArgumentException("No active kitchen batch matches this time. Choose a configured batch or another date.");
        if (incoming.Count > 0 && ModeFor(day) != Continuous && !string.IsNullOrWhiteSpace(batchCode)
            && !string.Equals(batch?.BatchCode, batchCode.Trim(), StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("The selected kitchen batch is unavailable for this date and branch.");

        var incomingLoad = CombinedLoad(incoming);
        var max = batch is null ? branch.TotalPits : BatchLimit(branch, batch);
        long current;
        long added;
        long projected;
        long squeezed;
        if (batch is not null)
        {
            var existing = workload.LoadForBatch(day, batch, batches);
            var combined = existing + incomingLoad;
            current = existing.Pits(branch.SafeBelliesPerPit);
            added = incomingLoad.Pits(branch.SafeBelliesPerPit);
            projected = combined.Pits(branch.SafeBelliesPerPit);
            squeezed = combined.Pits(branch.MaxSqueezeBelliesPerPit);
        }
        else
        {
            (current, added, projected, squeezed) = ProjectTimeline(workload.Timeline, incoming, branch);
        }

        var suggestion = incoming.Count > 0 && projected >= max
            ? await FindSuggestionAsync(branch, day, batch, target, departure, fulfillment, incoming, excludeOrderId,
                cancellationToken)
            : null;
        return new(branch.Code, batch?.BatchCode, current, added, projected, max, Math.Max(0, max - projected),
            Status(projected, max), projected > max && squeezed <= max, squeezed, suggestion,
            incoming.Count > 0 && projected > max);
    }

    internal async Task<KitchenBranch> ResolveBranchAsync(string? code) =>
        (await GetBranchAsync(code, CancellationToken.None)).Branch;

    private async Task<(KitchenBranch Branch, List<KitchenBranch> Active)> GetBranchAsync(
        string? code, CancellationToken cancellationToken)
    {
        var active = await context.KitchenBranches.AsNoTracking().Where(branch => branch.IsActive)
            .OrderByDescending(branch => branch.IsDefault).ThenBy(branch => branch.Name).ToListAsync(cancellationToken);
        var selected = string.IsNullOrWhiteSpace(code) ? active.FirstOrDefault() :
            active.FirstOrDefault(branch => string.Equals(branch.Code, code.Trim(), StringComparison.OrdinalIgnoreCase));
        return (selected ?? throw new ArgumentException("Choose an active kitchen branch."), active);
    }

    private async Task<KitchenWorkload> LoadWorkloadAsync(KitchenBranch branch, DateTime from, DateTime through,
        int? excludeOrderId, CancellationToken cancellationToken)
    {
        // Bookings that roast before midnight or carry a post-departure buffer can affect a neighboring day.
        var lower = from.AddDays(-2);
        var upper = through.AddDays(3);
        var orders = await WithSchedules(context.Orders.AsNoTracking())
            .Where(order => !order.IsDraft && !order.IsCancelled && order.Id != excludeOrderId
                            && order.KitchenBranch == branch.Code && order.TargetDeliveryTime.HasValue
                            && ((order.TargetDeliveryTime >= lower && order.TargetDeliveryTime < upper)
                                || (order.RiderDepartureTime >= lower && order.RiderDepartureTime < upper)))
            .ToListAsync(cancellationToken);
        var profiles = await context.ProductCookingProfiles.AsNoTracking().ToDictionaryAsync(profile => profile.ItemCategoryId, cancellationToken);
        var presets = await context.KitchenBatchPresets.AsNoTracking()
            .Where(batch => batch.BranchCode == branch.Code && batch.IsActive)
            .OrderBy(batch => batch.SortOrder).ThenBy(batch => batch.AnchorTime).ToListAsync(cancellationToken);
        var booked = new List<BookedOrder>();

        foreach (var order in orders)
        {
            var target = order.TargetDeliveryTime!.Value;
            var departure = OrderService.ResolveDepartureTime(target, order.RiderDepartureTime, order.Fulfillment);
            var roasts = new List<Roast>();
            foreach (var item in order.OrderItems)
            {
                var category = item.FulfilledItemCategory ?? item.ItemCategory;
                if (category is null || category.MinimumWeightKg <= 0 || item.Quantity <= 0)
                    continue;

                profiles.TryGetValue(category.Id, out var profile);
                AddRoasts(roasts, item.Quantity, category, profile, item.OrderItemSchedules, departure, branch);
            }
            if (roasts.Count > 0)
                booked.Add(new(KitchenDate(target, departure, order.Fulfillment), order.KitchenBatchCode, departure, roasts));
        }

        return new(presets, booked);
    }

    private async Task<Dictionary<int, (ItemCategory Category, ProductCookingProfile? Profile)>> LoadProductsAsync(
        IEnumerable<int> categoryIds, CancellationToken cancellationToken)
    {
        var ids = categoryIds.Distinct().ToList();
        return await (from category in context.ItemCategories.AsNoTracking()
                      where ids.Contains(category.Id)
                      join profile in context.ProductCookingProfiles.AsNoTracking()
                          on category.Id equals profile.ItemCategoryId into profiles
                      from profile in profiles.DefaultIfEmpty()
                      select new { category, profile })
            .ToDictionaryAsync(row => row.category.Id, row => (row.category, (ProductCookingProfile?)row.profile), cancellationToken);
    }

    private async Task<Order?> LoadPreviousOrderAsync(int? orderId, CancellationToken cancellationToken)
    {
        if (!orderId.HasValue)
            return null;

        return await WithSchedules(context.Orders.AsNoTracking())
            .FirstOrDefaultAsync(order => order.Id == orderId && !order.IsDraft && !order.IsCancelled,
                cancellationToken);
    }

    private static IQueryable<Order> WithSchedules(IQueryable<Order> orders) =>
        orders.Include(order => order.OrderItems).ThenInclude(item => item.ItemCategory)
            .Include(order => order.OrderItems).ThenInclude(item => item.FulfilledItemCategory)
            .Include(order => order.OrderItems).ThenInclude(item => item.OrderItemSchedules).AsSplitQuery();

    private static List<Roast> BuildIncomingRoasts(IReadOnlyList<KitchenCapacityItem> items,
        Dictionary<int, (ItemCategory Category, ProductCookingProfile? Profile)> products, Order? previous,
        DateTime target, DateTime departure, FulfillmentType fulfillment, KitchenBranch branch)
    {
        var roasts = new List<Roast>();
        var available = previous?.OrderItems.ToList() ?? [];
        var keepAutomatic = previous is not null && previous.TargetDeliveryTime == target && previous.Fulfillment == fulfillment &&
            OrderService.ResolveDepartureTime(target, previous.RiderDepartureTime, fulfillment) == departure &&
            available.Count == items.Count && items.All(item => available.Any(existing =>
                (item.OrderItemId.HasValue ? item.OrderItemId == existing.Id : item.ItemCategoryId == existing.ItemCategoryId) &&
                item.ItemCategoryId == existing.ItemCategoryId && item.Quantity == existing.Quantity &&
                CategoryId(item) == (existing.FulfilledItemCategoryId ?? existing.ItemCategoryId)));
        foreach (var item in items)
        {
            var id = CategoryId(item);
            if (!products.TryGetValue(id, out var product))
                throw new ArgumentException($"Item category {id} is unavailable.");
            if (product.Category.MinimumWeightKg <= 0 || item.Quantity <= 0)
                continue;

            var existing = item.OrderItemId == 0 ? null : available.FirstOrDefault(candidate =>
                item.OrderItemId.HasValue ? item.OrderItemId == candidate.Id : item.ItemCategoryId == candidate.ItemCategoryId);
            if (existing is not null)
                available.Remove(existing);
            var schedules = existing?.OrderItemSchedules.Where(schedule => keepAutomatic || schedule.IsManualOverride);
            AddRoasts(roasts, item.Quantity, product.Category, product.Profile, schedules, departure, branch, target);
        }
        return roasts;
    }

    private static void AddRoasts(List<Roast> roasts, int quantity, ItemCategory category, ProductCookingProfile? profile,
        IEnumerable<OrderItemSchedule>? schedules, DateTime departure, KitchenBranch branch, DateTime? editTarget = null)
    {
        var fallback = departure.AddMinutes(-(profile?.SalangDurationMinutes ?? 180) - (profile?.PackagingDurationMinutes ?? 30));
        var end = departure.AddMinutes(branch.PostDepartureBufferMinutes);
        Roast ScheduledRoast(OrderItemSchedule? schedule, RoastLoad load)
        {
            var start = schedule?.SalangStartTime;
            if (schedule?.IsManualOverride == true && editTarget.HasValue)
                start += editTarget.Value.Date - schedule.TargetDeliveryTime.Date;
            return new(ResolveStart(start, departure, fallback), end, load, schedule?.IsManualOverride == true ? start : null);
        }

        if (SchedulingService.IsBellyCategory(category.Name))
        {
            roasts.Add(ScheduledRoast(schedules?.FirstOrDefault(schedule => schedule.UnitIndex == 1), new(0, quantity)));
            return;
        }

        var scheduledHeads = schedules?.Where(schedule => schedule.UnitIndex <= quantity).ToList() ?? [];
        foreach (var head in scheduledHeads)
            roasts.Add(ScheduledRoast(head, new(1, 0)));
        if (quantity > scheduledHeads.Count)
            roasts.Add(new(fallback, end, new(quantity - scheduledHeads.Count, 0)));
    }

    private static DateTime ResolveStart(DateTime? start, DateTime departure, DateTime fallback)
    {
        if (!start.HasValue)
            return fallback;
        // Older schedules stored the clock on the event date even when roasting began the night before.
        return start > departure && start.Value.Date == departure.Date ? start.Value.AddDays(-1) : start.Value;
    }

    private static int CategoryId(KitchenCapacityItem item) => item.FulfilledItemCategoryId ?? item.ItemCategoryId;

    private static DateTime KitchenDate(DateTime target, DateTime departure, FulfillmentType fulfillment) =>
        fulfillment == FulfillmentType.Lalamove && departure.Date == target.Date.AddDays(-1) ? departure.Date : target.Date;

    private static bool IsHalfDay(DateTime date) => date.Month == 12 && date.Day == 25;

    private static string ModeFor(DateTime date) => date.Month == 12 && date.Day is 24 or 31
        ? PeakHoliday : !IsHalfDay(date) && date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday ? Weekend : Continuous;

    private static KitchenBatchPreset? FindBatch(List<KitchenBatchPreset> batches, string? code, DateTime departure,
        bool historical = false)
    {
        var minute = new TimeSpan(departure.Hour, departure.Minute, 0);
        return batches.FirstOrDefault(batch => string.Equals(batch.BatchCode, code?.Trim(), StringComparison.OrdinalIgnoreCase))
               ?? batches.FirstOrDefault(batch => batch.StartTime <= minute && minute <= batch.EndTime)
               ?? (historical ? batches.MinBy(batch => (batch.AnchorTime - minute).Duration()) : null);
    }

    private static int BatchLimit(KitchenBranch branch, KitchenBatchPreset batch) => Math.Min(branch.TotalPits, batch.MaxPits);

    private static RoastLoad CombinedLoad(IEnumerable<Roast> roasts) =>
        roasts.Aggregate(new RoastLoad(), (total, roast) => total + roast.Load);

    private static KitchenCapacityLoad MakeLoad(string code, string label, TimeSpan start, TimeSpan end, TimeSpan anchor,
        RoastLoad load, int limit, KitchenBranch branch)
    {
        var used = load.Pits(branch.SafeBelliesPerPit);
        return new(code, label, start, end, anchor, used, limit, load.Whole, load.Belly, Math.Max(0, limit - used), Status(used, limit));
    }

    private static string Status(long used, int limit) => (limit - used) switch
    {
        < 0 => "Overbooked",
        0 => "Full",
        1 => "LastSlot",
        _ => "Open"
    };

    private static RoastLoad PeakLoad(IReadOnlyList<Roast> roasts, DateTime start, DateTime end, int belliesPerPit)
    {
        var changes = new SortedDictionary<DateTime, (RoastLoad Existing, RoastLoad Incoming)>();
        AddChanges(changes, roasts, start, end, incoming: false);
        var peak = new RoastLoad();
        var current = new RoastLoad();
        foreach (var change in changes.Values)
        {
            current += change.Existing;
            if (current.Pits(belliesPerPit) > peak.Pits(belliesPerPit))
                peak = current;
        }
        return peak;
    }

    private static (long Current, long Incoming, long Projected, long Squeezed) ProjectTimeline(
        IReadOnlyList<Roast> existing, IReadOnlyList<Roast> incoming, KitchenBranch branch)
    {
        if (incoming.Count == 0)
            return (0, 0, 0, 0);

        var start = incoming.Min(roast => roast.Start);
        var end = incoming.Max(roast => roast.End);
        var changes = new SortedDictionary<DateTime, (RoastLoad Existing, RoastLoad Incoming)>();
        AddChanges(changes, existing, start, end, incoming: false);
        AddChanges(changes, incoming, start, end, incoming: true);
        var currentLoad = new RoastLoad();
        var incomingLoad = new RoastLoad();
        long current = 0, added = 0, projected = 0, squeezed = 0;

        foreach (var change in changes.Values)
        {
            currentLoad += change.Existing;
            incomingLoad += change.Incoming;
            if (incomingLoad == default)
                continue;
            var combined = currentLoad + incomingLoad;
            current = Math.Max(current, currentLoad.Pits(branch.SafeBelliesPerPit));
            added = Math.Max(added, incomingLoad.Pits(branch.SafeBelliesPerPit));
            projected = Math.Max(projected, combined.Pits(branch.SafeBelliesPerPit));
            squeezed = Math.Max(squeezed, combined.Pits(branch.MaxSqueezeBelliesPerPit));
        }

        return (current, added, projected, squeezed);
    }

    private static void AddChanges(SortedDictionary<DateTime, (RoastLoad Existing, RoastLoad Incoming)> changes,
        IReadOnlyList<Roast> roasts, DateTime start, DateTime end, bool incoming)
    {
        foreach (var roast in roasts)
        {
            var clippedStart = roast.Start > start ? roast.Start : start;
            var clippedEnd = roast.End < end ? roast.End : end;
            if (clippedStart >= clippedEnd)
                continue;
            var opening = changes.GetValueOrDefault(clippedStart);
            var closing = changes.GetValueOrDefault(clippedEnd);
            changes[clippedStart] = incoming
                ? (opening.Existing, opening.Incoming + roast.Load)
                : (opening.Existing + roast.Load, opening.Incoming);
            changes[clippedEnd] = incoming
                ? (closing.Existing, closing.Incoming - roast.Load)
                : (closing.Existing - roast.Load, closing.Incoming);
        }
    }

    private async Task<SuggestedKitchenSlot?> FindSuggestionAsync(KitchenBranch branch, DateTime day,
        KitchenBatchPreset? atBatch, DateTime target, DateTime departure, FulfillmentType fulfillment,
        IReadOnlyList<Roast> incoming, int? excludeOrderId, CancellationToken cancellationToken)
    {
        var through = day.AddDays(SuggestionDays);
        var workload = await LoadWorkloadAsync(branch, day, through, excludeOrderId, cancellationToken);
        var total = CombinedLoad(incoming);
        if (total.Pits(branch.SafeBelliesPerPit) > branch.TotalPits)
            return null;

        // The earliest feasible shift can begin when an existing roast frees a pit.
        var startOffsets = incoming.Select(roast => departure - roast.Start).Distinct().ToList();
        var releases = workload.Timeline.Select(roast => roast.End).Distinct()
            .SelectMany(end => startOffsets.Select(offset => end + offset)).Distinct().Order().ToList();
        var targetOffset = target - departure;

        for (var candidateDay = day; candidateDay <= through; candidateDay = candidateDay.AddDays(1))
        {
            var batches = workload.Batches(candidateDay);
            if (ModeFor(candidateDay) != Continuous)
            {
                foreach (var batch in batches.OrderBy(batch => batch.AnchorTime))
                {
                    var anchor = candidateDay.Add(batch.AnchorTime);
                    if (anchor <= departure || (candidateDay == day && batch.Id == atBatch?.Id))
                        continue;
                    if ((workload.LoadForBatch(candidateDay, batch, batches) + total).Pits(branch.SafeBelliesPerPit) <= BatchLimit(branch, batch))
                        return Suggest(anchor, targetOffset, batch.BatchCode, batch.Label);
                }
                continue;
            }

            var candidateStart = candidateDay == day ? departure.AddMinutes(1) : candidateDay;
            var candidateEnd = candidateDay.AddHours(IsHalfDay(candidateDay) ? 12 : 24);
            foreach (var anchor in releases.Where(time => time >= candidateStart && time < candidateEnd).Prepend(candidateStart))
            {
                if (anchor >= candidateEnd || KitchenDate(anchor + targetOffset, anchor, fulfillment) != candidateDay)
                    continue;
                var dateShift = (anchor + targetOffset).Date - target.Date;
                var shifted = incoming.Select(roast => roast.Shift(anchor - departure, dateShift, anchor)).ToList();
                if (ProjectTimeline(workload.Timeline, shifted, branch).Projected <= branch.TotalPits)
                    return Suggest(anchor, targetOffset, null, anchor.ToString("h:mm tt", CultureInfo.InvariantCulture));
            }
        }
        return null;
    }

    private static SuggestedKitchenSlot Suggest(DateTime departure, TimeSpan targetOffset, string? batchCode, string label) =>
        new(DateOnly.FromDateTime(departure + targetOffset), departure + targetOffset, departure, batchCode, label);

    private static DateTime ValidateDate(DateOnly date) =>
        date.Year is >= 2000 and <= 9998 ? date.ToDateTime(TimeOnly.MinValue)
            : throw new ArgumentException("Enter a valid scheduling date in YYYY-MM-DD format.");

    private static DateTime ParseLocalTime(string value, DateTime date)
    {
        if (TimeOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return date.Add(time.ToTimeSpan());
        // Offsetless ISO inputs and plain clocks represent Manila time. Honor explicit offsets on absolute inputs.
        if (value.Length >= 16 && DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal, out var dateTime))
        {
            var timePart = value.AsSpan(10);
            return timePart.Contains('Z') || timePart.Contains('z') || timePart.Contains('+') || timePart.Contains('-')
                ? dateTime.ToOffset(TimeSpan.FromHours(8)).DateTime
                : dateTime.DateTime;
        }
        throw new ArgumentException("Enter a valid scheduling time.");
    }
}

public sealed class KitchenCapacityExceededException(KitchenCapacityEvaluation capacity) : Exception(
    $"Slot full ({capacity.MaxPits}/{capacity.MaxPits} pits). Choose another batch/time or ask the Owner to approve a squeeze/override.")
{
    public KitchenCapacityEvaluation Capacity { get; } = capacity;
}
