using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Models;

[Index(nameof(HolidayDate), IsUnique = true)]
public class PayrollHoliday
{
    public int Id { get; set; }
    public DateOnly HolidayDate { get; set; }
    [MaxLength(120)] public string Name { get; set; } = string.Empty;
    [MaxLength(16)] public string HolidayType { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
