using System.ComponentModel.DataAnnotations;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.DTOs;

public sealed class KitchenCapacityRequest
{
    public DateOnly Date { get; set; }
    [Required]
    public string TargetTime { get; set; } = string.Empty;
    public string? RiderDepartureTime { get; set; }
    [MaxLength(50)]
    public string? BranchCode { get; set; }
    [MaxLength(50)]
    public string? BatchCode { get; set; }
    public List<KitchenCapacityItem> Items { get; set; } = new();
    public int? ExcludeOrderId { get; set; }
    public FulfillmentType Fulfillment { get; set; } = FulfillmentType.Pickup;
}

public sealed record KitchenCapacityItem(
    int ItemCategoryId, int Quantity, int? FulfilledItemCategoryId = null, int? OrderItemId = null);

public sealed record KitchenCapacityLoad(
    string BatchCode, string Label, TimeSpan StartTime, TimeSpan EndTime, TimeSpan AnchorTime,
    long UsedPits, int MaxPits, long WholeCount, long BellyCount, long RemainingPits, string Status);

public sealed record KitchenCapacityDay(
    DateOnly Date, string Mode, bool IsHalfDayHoliday, KitchenBranch Branch,
    IReadOnlyList<KitchenBranch> ActiveBranches, IReadOnlyList<KitchenCapacityLoad> Batches,
    IReadOnlyList<KitchenCapacityLoad> TimeBlocks, long PeakConcurrentPits);

public sealed record SuggestedKitchenSlot(
    DateOnly Date, DateTime TargetTime, DateTime RiderDepartureTime, string? BatchCode, string Label);

public sealed record KitchenCapacityEvaluation(
    string BranchCode, string? BatchCode, long CurrentPits, long IncomingPits, long ProjectedPits,
    int MaxPits, long RemainingAfter, string Status, bool CanFitWithOwnerSqueeze,
    long SqueezedProjectedPits, SuggestedKitchenSlot? SuggestedNextSlot, bool RequiresOwnerOverride);

public sealed record KitchenCapacityConfig(
    IReadOnlyList<KitchenBranch> Branches, IReadOnlyList<KitchenBatchPreset> Batches);
