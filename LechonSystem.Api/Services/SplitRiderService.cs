using LechonSystem.Api.Common;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Services;

public sealed class SplitRiderService(LechonDbContext context)
{
    public async Task AssignOrderRidersAsync(int orderId, AssignOrderRidersRequest request, string actor)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await SplitRiderSchema.LockOrderAsync(context, orderId);
        var order = await context.Orders
            .Include(order => order.DeliveryTrip)
            .Include(order => order.OrderItems).ThenInclude(item => item.ItemCategory)
            .Include(order => order.OrderItems).ThenInclude(item => item.FulfilledItemCategory)
            .Include(order => order.OrderItems).ThenInclude(item => item.OrderItemSchedules)
            .AsSplitQuery()
            .FirstOrDefaultAsync(order => order.Id == orderId)
            ?? throw new KeyNotFoundException($"Order #{orderId} was not found.");
        if (order.IsDraft || order.IsCancelled || order.Fulfillment != FulfillmentType.Delivery)
            throw new ArgumentException("Riders can only be assigned to active Delivery orders.");

        var lead = NormalizeName(request.RiderNameSpecified ? request.RiderName : order.DeliveryTrip?.RiderName);
        var support = NormalizeName(request.SupportRiderNameSpecified ? request.SupportRiderName : order.SupportRiderName);
        if (lead is null && !request.SupportRiderNameSpecified)
            support = null;

        decimal fee = 0m;
        int heads = 0;
        if (support is not null)
        {
            var totalHeads = order.OrderItems.Where(item => IsWholeLechon(item.FulfilledItemCategory ?? item.ItemCategory))
                .Sum(item => item.Quantity);
            if (totalHeads <= 2)
                throw new ArgumentException("A split-moto delivery requires more than two Whole Lechon heads.");
            if (lead is null || SameName(lead, support))
                throw new ArgumentException("Assign a lead rider and a different support rider for split-moto delivery.");
            if (order.DeliveryTrip is not null && SameName(lead, order.DeliveryTrip.RiderName)
                && !IsMotorcycle(order.DeliveryTrip.VehicleType))
                throw new ArgumentException("Split-moto delivery requires a motorcycle lead assignment.");

            fee = request.SupportRiderFee ?? (order.SupportRiderName is null ? order.DeliveryFee : order.SupportRiderFee);
            if (fee < 0 || fee > 9999999999999999.99m || decimal.Round(fee, 2) != fee)
                throw new ArgumentException("Enter a non-negative support rider fee with up to two decimal places.");
            heads = request.SupportRiderHeads ?? (order.SupportRiderName is null
                ? Math.Max(1, totalHeads - 2)
                : Math.Min(order.SupportRiderHeads, totalHeads - 1));
            if (heads < 1 || heads >= totalHeads)
                throw new ArgumentException($"Assign between 1 and {totalHeads - 1} Whole Lechon heads to the support rider.");
            support = (await RiderRegistrationHelper.EnsureRiderRegisteredAsync(context, support))?.FullName
                ?? throw new ArgumentException("Enter a valid support rider name.");
        }

        if (!SameName(lead, order.DeliveryTrip?.RiderName) && lead is not null)
        {
            lead = (await RiderRegistrationHelper.EnsureRiderRegisteredAsync(context, lead))?.FullName
                ?? throw new ArgumentException("Enter a valid lead rider name.");
        }

        SetSupport(order, support, fee, heads, actor);
        SetLead(order, lead, actor);
        if (request.SupportRiderNameSpecified || request.SupportRiderHeads.HasValue || support is null)
            ApplyOrderHeadAssignments(order);
        else
            ReconcileHeadAssignments(order, lead, fillSupport: true);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<OrderItemSchedule> AssignHeadAsync(int scheduleId, string? requestedName, string actor)
    {
        var orderId = await context.OrderItemSchedules.Where(schedule => schedule.Id == scheduleId)
            .Select(schedule => (int?)schedule.OrderItem!.OrderId).FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException($"Schedule #{scheduleId} was not found.");
        await using var transaction = await context.Database.BeginTransactionAsync();
        await SplitRiderSchema.LockOrderAsync(context, orderId);
        var schedule = await context.OrderItemSchedules
            .Include(schedule => schedule.OrderItem).ThenInclude(item => item!.ItemCategory)
            .Include(schedule => schedule.OrderItem).ThenInclude(item => item!.FulfilledItemCategory)
            .Include(schedule => schedule.OrderItem).ThenInclude(item => item!.Order).ThenInclude(order => order!.DeliveryTrip)
            .FirstOrDefaultAsync(schedule => schedule.Id == scheduleId)
            ?? throw new KeyNotFoundException($"Schedule #{scheduleId} was not found.");
        var item = schedule.OrderItem!;
        var order = item.Order!;
        if (order.IsDraft || order.IsCancelled || order.Fulfillment != FulfillmentType.Delivery
            || !IsWholeLechon(item.FulfilledItemCategory ?? item.ItemCategory))
            throw new ArgumentException("Per-head riders apply to Whole Lechon on active Delivery orders.");

        var lead = NormalizeName(order.DeliveryTrip?.RiderName);
        var requested = NormalizeName(requestedName);
        var assigned = requested is not null && SameName(requested, order.SupportRiderName) ? order.SupportRiderName : null;
        if (requested is not null && assigned is null && !SameName(requested, lead))
            throw new ArgumentException("Select the lead or support rider already assigned to this order.");
        if (SameName(assigned, schedule.AssignedRiderName))
            return schedule;

        if (assigned is not null)
        {
            if (order.SupportRiderHeads < 1)
                throw new ArgumentException("Set the backup head count on the order first.");

            var backupHeads = await context.OrderItemSchedules
                .Where(candidate => candidate.OrderItem!.OrderId == orderId && candidate.Id != scheduleId && candidate.AssignedRiderName == assigned)
                .OrderByDescending(candidate => candidate.OrderItemId).ThenByDescending(candidate => candidate.UnitIndex)
                .ToListAsync();
            foreach (var displaced in backupHeads.Take(backupHeads.Count - order.SupportRiderHeads + 1))
                SetHeadRider(order, displaced, null, lead, actor);
        }

        SetHeadRider(order, schedule, assigned, lead, actor);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return schedule;
    }

    private void SetHeadRider(Order order, OrderItemSchedule schedule, string? assigned, string? lead, string actor)
    {
        var previous = schedule.AssignedRiderName ?? lead ?? "Unassigned";
        schedule.AssignedRiderName = assigned;
        AddAudit(order, "Head Rider Updated",
            $"Rider for head {schedule.UnitIndex}/{schedule.UnitTotal} (item #{schedule.OrderItemId}) changed from '{previous}' to '{assigned ?? lead ?? "Unassigned"}'.",
            actor);
    }

    internal void SetLead(Order order, string? riderName, string actor)
    {
        var oldLead = NormalizeName(order.DeliveryTrip?.RiderName);
        var changed = !SameName(oldLead, riderName);
        if (!changed && riderName is not null)
            return;
        if (riderName is not null && SameName(riderName, order.SupportRiderName))
            throw new ArgumentException("The lead rider must be different from the support rider.");

        if (riderName is null)
        {
            order.DeliveryTrip = null;
            order.DeliveryTripId = null;
            order.RoutingStatus = DeliveryStatus.Unassigned;
            SetSupport(order, null, 0, 0, actor);
        }
        else
        {
            order.DeliveryTrip = new DeliveryTrip
            {
                RiderName = riderName,
                VehicleType = order.SupportRiderName is null ? order.DeliveryTrip?.VehicleType ?? "Motorcycle" : "Motorcycle",
                Status = DeliveryStatus.Assigned,
                DispatchTime = DateTime.UtcNow
            };
            if (order.RoutingStatus == DeliveryStatus.Unassigned)
                order.RoutingStatus = DeliveryStatus.Assigned;
        }

        ReconcileHeadAssignments(order, riderName);
        if (changed)
            AddAudit(order, "Rider Updated",
                $"Lead rider changed from '{oldLead ?? "Unassigned"}' to '{riderName ?? "Unassigned"}'.", actor);
    }

    internal void SetSupport(Order order, string? name, decimal fee, int heads, string actor)
    {
        var previous = (Name: order.SupportRiderName, Fee: order.SupportRiderFee, Heads: order.SupportRiderHeads);
        if (SameName(previous.Name, name) && previous.Fee == fee && previous.Heads == heads)
            return;

        order.SupportRiderName = name;
        order.SupportRiderFee = fee;
        order.SupportRiderHeads = heads;
        AddAudit(order, "Support Rider Updated",
            $"Support rider changed from '{previous.Name ?? "None"}' ({previous.Heads} head(s), ₱{previous.Fee:N2}) " +
            $"to '{name ?? "None"}' ({heads} head(s), ₱{fee:N2} store-shouldered).", actor);
    }

    internal void AddSettlementExpense(Order order, string actor, bool? enabled)
    {
        if (enabled == false || order.Fulfillment != FulfillmentType.Delivery || order.IsDraft || order.IsCancelled
            || order.SupportRiderExpenseId.HasValue || order.SupportRiderExpense is not null || order.SupportRiderFee <= 0
            || order.SupportRiderName is not { Length: > 0 } support)
            return;

        var category = ExpenseCategorizer.Labor;
        var actorName = LimitLength(actor, 128);
        order.SupportRiderExpense = new ExpenseRecord
        {
            ExpenseDate = PhilippineTime.Today,
            Category = category,
            CostType = ExpenseCategorizer.GetCostType(category),
            ItemDescription = LimitLength($"Support Moto Rider Fee ({support}) — Split Delivery for {order.OrderReference} ({order.CustomerName})", 250),
            Quantity = 1,
            Unit = "Trip",
            UnitCost = order.SupportRiderFee,
            TotalCost = order.SupportRiderFee,
            PaymentMethod = "Cash",
            Remarks = $"Store-shouldered support rider fee for order #{order.OrderReference}.",
            EncodedBy = actorName,
            CreatedAt = DateTime.UtcNow
        };
        context.Expenses.Add(order.SupportRiderExpense);
        AddAudit(order, "Support Rider Expense Logged",
            $"Auto-logged ₱{order.SupportRiderFee:N2} store-shouldered support rider fee for {support} to Expenses Ledger.", actorName);
    }

    internal static void RequireLeadCollector(Order order, string? riderName)
    {
        if (order.SupportRiderName is not null && !SameName(order.DeliveryTrip?.RiderName, riderName))
            throw new InvalidOperationException("Only the lead rider can remit this split delivery. The support rider collects ₱0.");
    }

    private static void ApplyOrderHeadAssignments(Order order)
    {
        foreach (var schedule in order.OrderItems.SelectMany(item => item.OrderItemSchedules))
            schedule.AssignedRiderName = null;

        if (order.SupportRiderName is not { } support)
            return;

        var wholeHeads = order.OrderItems
            .Where(item => IsWholeLechon(item.FulfilledItemCategory ?? item.ItemCategory))
            .OrderBy(item => item.Id)
            .SelectMany(item => item.OrderItemSchedules.OrderBy(schedule => schedule.UnitIndex));
        foreach (var schedule in wholeHeads.TakeLast(order.SupportRiderHeads))
            schedule.AssignedRiderName = support;
    }

    internal static void ReconcileHeadAssignments(Order order, string? lead, bool fillSupport = false)
    {
        var available = new List<OrderItemSchedule>();
        var remainingSupportHeads = order.SupportRiderHeads;
        foreach (var item in order.OrderItems.OrderBy(item => item.Id))
        {
            var category = item.FulfilledItemCategory ?? item.ItemCategory;
            foreach (var schedule in item.OrderItemSchedules.OrderBy(schedule => schedule.UnitIndex))
            {
                if (category is not null && !IsWholeLechon(category))
                {
                    schedule.AssignedRiderName = null;
                    continue;
                }
                if (SameName(schedule.AssignedRiderName, order.SupportRiderName) && remainingSupportHeads > 0)
                {
                    remainingSupportHeads--;
                    continue;
                }
                if (!SameName(schedule.AssignedRiderName, lead))
                    schedule.AssignedRiderName = null;
                if (fillSupport && IsWholeLechon(category))
                    available.Add(schedule);
            }
        }

        if (order.SupportRiderName is null || remainingSupportHeads <= 0)
            return;

        // Keep explicit support picks. Allocate the remaining heads from the end of the roster,
        // using unassigned heads before replacing an explicit lead assignment.
        foreach (var schedule in available.AsEnumerable().Reverse()
                     .OrderBy(candidate => candidate.AssignedRiderName is not null)
                     .Take(remainingSupportHeads))
            schedule.AssignedRiderName = order.SupportRiderName;
    }

    internal static bool IsWholeLechon(ItemCategory? category) =>
        category is { MinimumWeightKg: > 0 } && !SchedulingService.IsBellyCategory(category.Name);

    internal static string? NormalizeName(string? name) =>
        string.IsNullOrWhiteSpace(name) || SameName(name.Trim(), "Unassigned") ? null : name.Trim();

    internal static bool SameName(string? a, string? b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    internal static bool IsMotorcycle(string? vehicleType) =>
        string.IsNullOrWhiteSpace(vehicleType) || SameName(vehicleType.Trim(), "Motorcycle");

    private void AddAudit(Order order, string actionType, string changes, string actor) =>
        context.OrderAuditLogs.Add(new OrderAuditLog
        {
            OrderId = order.Id,
            ActionType = actionType,
            Changes = changes,
            ChangedBy = actor,
            Timestamp = DateTime.UtcNow
        });

    private static string LimitLength(string value, int maxLength)
    {
        if (value.Length <= maxLength)
            return value;
        var length = char.IsHighSurrogate(value[maxLength - 1]) ? maxLength - 1 : maxLength;
        return value[..length];
    }
}
