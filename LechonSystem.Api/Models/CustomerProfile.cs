using System.ComponentModel.DataAnnotations;

namespace LechonSystem.Api.Models;

public class CustomerProfile
{
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string ContactNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? FacebookName { get; set; }

    public string? DefaultAddress { get; set; }
    public string? DefaultLandmark { get; set; }
    public string? Preferences { get; set; }
    public string? ComplaintHistory { get; set; }
    public bool IsVip { get; set; } = false;
    public int TotalOrdersCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
