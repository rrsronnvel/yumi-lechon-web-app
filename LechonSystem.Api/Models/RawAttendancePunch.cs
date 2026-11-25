using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(BiometricUserId), nameof(PunchTime), IsUnique = true)]
[Index(nameof(PunchTime))]
public class RawAttendancePunch
{
    public int Id { get; set; }
    public int BiometricUserId { get; set; }
    [MaxLength(120)] public string? BiometricNameSnapshot { get; set; }
    public DateTime PunchTime { get; set; }
    public int ImportBatchId { get; set; }
    public BiometricImportBatch ImportBatch { get; set; } = null!;
}
