using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace LechonSystem.Api.DTOs;

/// <summary>
/// Top-level response for GET /api/schedules/freebies-prep?date=YYYY-MM-DD
/// </summary>
public class FreebiesPrepResponseDto
{
    public string TargetDate { get; set; } = string.Empty;
    public string FormattedDate { get; set; } = string.Empty;
    public FreebiesPrepSummaryDto Summary { get; set; } = new();
    public List<FreebiePrepRosterRowDto> Roster { get; set; } = new();
    public List<KitchenPrepRequestDto> PrepRequests { get; set; } = new();
}

/// <summary>
/// Section 1: Morning Aggregate Prep Board across 8 high-contrast side-dish cards
/// </summary>
public class FreebiesPrepSummaryDto
{
    public SarsaSummaryDto Sarsa { get; set; } = new();
    public FreebieItemSummaryDto Pancit { get; set; } = new();
    public FreebieItemSummaryDto Palabok { get; set; } = new();
    public FreebieItemSummaryDto Spaghetti { get; set; } = new();
    public DinuguanSummaryDto Dinuguan { get; set; } = new();
    public FreebieItemSummaryDto Puto { get; set; } = new();
    public CokeSummaryDto Coke15L { get; set; } = new();
    public RawInnardsSummaryDto RawInnardsHilaw { get; set; } = new();
}

/// <summary>
/// Granular count breakdown for an individual prep item card (Pancit, Palabok, Spaghetti, Puto)
/// </summary>
public class FreebieItemSummaryDto
{
    public virtual int Total => Freebies + PaidAddOns + Paluto;
    public int Freebies { get; set; }
    public int PaidAddOns { get; set; }
    public int Paluto { get; set; }
}

/// <summary>
/// Breakdown for Sarsa (Liver Sauce)
/// Guaranteed 1x Sarsa per whole lechon even when opted out of the 7 freebies (Less ₱2k)
/// </summary>
public class SarsaSummaryDto : FreebieItemSummaryDto
{
    public int WholeFreebies { get; set; }
    public int BellyFreebies { get; set; }
    public int NoFreebiesSarsaGuaranteed { get; set; }
    public int GuaranteedSarsa => NoFreebiesSarsaGuaranteed;
    public new int Freebies => WholeFreebies + BellyFreebies + NoFreebiesSarsaGuaranteed;
    public override int Total => WholeFreebies + NoFreebiesSarsaGuaranteed + BellyFreebies + PaidAddOns + Paluto;
}

/// <summary>
/// Breakdown for Dinuguan (Cooked)
/// Excludes whole lechon orders requesting Raw Innards / Walang Dinuguan
/// </summary>
public class DinuguanSummaryDto : FreebieItemSummaryDto
{
    public int ExcludedRawInnardsOrders { get; set; }
    public int ExcludedRawInnards => ExcludedRawInnardsOrders;
}

/// <summary>
/// Breakdown for 1.5L Coke
/// Accounts for 4x 1.5L Coke per 5kg Belly Bilao Swap
/// </summary>
public class CokeSummaryDto : FreebieItemSummaryDto
{
    public int BellySwaps { get; set; }
    public int Swaps => BellySwaps;
    public override int Total => Freebies + BellySwaps + PaidAddOns + Paluto;
}

/// <summary>
/// Breakdown for Raw Innards (Hilaw - Lamang Loob)
/// </summary>
public class RawInnardsSummaryDto
{
    public int Total => Bags + PaidAddOns + Paluto;
    public int Bags { get; set; }
    public int Freebies => Bags;
    public int PaidAddOns { get; set; }
    public int Paluto { get; set; }
}

/// <summary>
/// Section 2: Chronological Kitchen Packing & Prep Roster Row
/// Merged chronological row representing a Customer Order or a Store Paluto Request
/// </summary>
public class FreebiePrepRosterRowDto
{
    public string Id { get; set; } = string.Empty; // e.g. "ord-111026-001" or "prep-1"
    public string RowType { get; set; } = "Order"; // "Order" | "Paluto"
    public int? OrderId { get; set; }
    public int? PrepRequestId { get; set; }
    public bool IsPrepRequest { get; set; }
    public string OrderRef { get; set; } = string.Empty; // "#111026-001" or "PALUTO-1"
    public string OrderReference { get; set; } = string.Empty;
    public string Recipient { get; set; } = string.Empty; // Customer Name or Paluto Recipient
    public string? CustomerName { get; set; }
    public string? FacebookName { get; set; }
    public string TypeItem { get; set; } = string.Empty; // "1x L", "1x Belly 5kg", or "👥 Staff Meryenda"
    public string? Category { get; set; } // For Paluto: "Staff Meryenda", etc.
    public string FulfillmentType { get; set; } = string.Empty; // "Delivery", "Pickup", "Lalamove", "Internal"
    public string RouteDisplay { get; set; } = string.Empty; // "🛵 AL", "🏪 Store Pickup", "📦 Lalamove", "🏠 Internal Kitchen"
    public string? RiderName { get; set; }
    public DateTime? TimeNeeded { get; set; }
    public string TimeNeededDisplay { get; set; } = string.Empty; // "08:30 AM", "10:30 AM", "⏳ TIME TBD"
    public bool IsTimeTbd { get; set; }
    public bool IsNoFreebies { get; set; }
    public bool IsRawInnards { get; set; }
    public bool HasBellyCokeSwap { get; set; }
    public string? FreebiesSummary { get; set; }
    public List<PackItemPillDto> ChecklistPills { get; set; } = new();
    public string Remarks { get; set; } = string.Empty;
    public string? CreatedBy { get; set; }
}

/// <summary>
/// Individual pack item pill rendered in the checklist column
/// </summary>
public class PackItemPillDto
{
    public string ItemName { get; set; } = string.Empty; // "Sarsa", "Pancit", "Palabok", etc.
    public int Quantity { get; set; }
    public string BadgeType { get; set; } = "Freebie"; // "Freebie" | "PaidAddOn" | "Paluto" | "Special" | "NoFreebies"
    public string Label { get; set; } = string.Empty; // e.g. "1x Sarsa", "+ 2x Spaghetti (Paid Add-On)", "🚫 NO FREEBIES • 1x Sarsa Only"
}

/// <summary>
/// KitchenPrepRequest representation returned to clients
/// </summary>
public class KitchenPrepRequestDto
{
    public int Id { get; set; }
    public DateTime TargetDate { get; set; }
    public DateTime TargetTime { get; set; }
    public string TargetTimeDisplay { get; set; } = string.Empty; // "03:00 PM"
    public string Category { get; set; } = string.Empty;
    public string RecipientOrLabel { get; set; } = string.Empty;
    public string ItemsJson { get; set; } = "{}";
    public Dictionary<string, int> Items { get; set; } = new();
    public string? Remarks { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Payload for POST /api/schedules/prep-requests
/// </summary>
public class CreateKitchenPrepRequestDto
{
    [Required]
    public DateTime TargetDate { get; set; }

    [Required]
    public DateTime TargetTime { get; set; }

    [Required]
    [MaxLength(64)]
    public string Category { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string RecipientOrLabel { get; set; } = string.Empty;

    public Dictionary<string, int>? Items { get; set; }

    public string? ItemsJson { get; set; }

    [MaxLength(500)]
    public string? Remarks { get; set; }

    [MaxLength(100)]
    public string? CreatedBy { get; set; }
}
