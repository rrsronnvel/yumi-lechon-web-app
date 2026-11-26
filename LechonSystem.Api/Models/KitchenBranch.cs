using System.ComponentModel.DataAnnotations;

namespace LechonSystem.Api.Models;

public class KitchenBranch
{
    public int Id { get; set; }
    [Required, MaxLength(50)]
    public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    [Range(1, 1000)]
    public int TotalPits { get; set; } = 14;
    [Range(1, 4)]
    public int SafeBelliesPerPit { get; set; } = 3;
    [Range(1, 4)]
    public int MaxSqueezeBelliesPerPit { get; set; } = 4;
    [Range(0, 1440)]
    public int PostDepartureBufferMinutes { get; set; }
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
}
