using System.ComponentModel.DataAnnotations;

namespace LechonSystem.Api.Models;

public class BiometricImportBatch
{
    public int Id { get; set; }
    [MaxLength(255)] public string FileName { get; set; } = string.Empty;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int PunchesImported { get; set; }
    public int DuplicatesSkipped { get; set; }
    public int UnmappedUserCount { get; set; }
    [MaxLength(128)] public string ImportedBy { get; set; } = string.Empty;
    public DateTime ImportedAt { get; set; }
}
