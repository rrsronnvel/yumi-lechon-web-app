using System.ComponentModel.DataAnnotations;

namespace LechonSystem.Api.Models;

public class KitchenBatchPreset
{
    public int Id { get; set; }
    [Required, MaxLength(50)]
    public string BranchCode { get; set; } = string.Empty;
    [Required, MaxLength(50)]
    public string ScheduleType { get; set; } = string.Empty;
    [Required, MaxLength(50)]
    public string BatchCode { get; set; } = string.Empty;
    [Required, MaxLength(100)]
    public string Label { get; set; } = string.Empty;
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public TimeSpan AnchorTime { get; set; }
    [Range(1, 1000)]
    public int MaxPits { get; set; } = 14;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
