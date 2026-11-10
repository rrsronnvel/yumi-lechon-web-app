using System;
using System.ComponentModel.DataAnnotations;

namespace LechonSystem.Api.Models;

public class KitchenPrepRequest
{
    public int Id { get; set; }

    public DateTime TargetDate { get; set; }

    public DateTime TargetTime { get; set; }

    [MaxLength(64)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(150)]
    public string RecipientOrLabel { get; set; } = string.Empty;

    public string ItemsJson { get; set; } = "{}";

    [MaxLength(500)]
    public string? Remarks { get; set; }

    [MaxLength(100)]
    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
