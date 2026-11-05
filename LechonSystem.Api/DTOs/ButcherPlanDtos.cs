using System.Collections.Generic;

namespace LechonSystem.Api.DTOs;

public class ButcherPlanItemDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string WeightBracket { get; set; } = string.Empty;
    public decimal MinimumWeightKg { get; set; }
    public decimal MaximumWeightKg { get; set; }
    public List<string> CustomWeights { get; set; } = new();
    public int UpcomingOrdersCount { get; set; }
    public int AvailableFreezerStock { get; set; }
    public int SuggestedSlaughterCount { get; set; }
}

public class ButcherPlanResponseDto
{
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string DateRangeLabel { get; set; } = string.Empty;
    public int TotalUpcomingOrders { get; set; }
    public int TotalAvailableFreezerStock { get; set; }
    public int TotalSuggestedSlaughter { get; set; }
    public List<ButcherPlanItemDto> Items { get; set; } = new();
}
