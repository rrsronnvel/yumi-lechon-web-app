using System;

namespace LechonSystem.Api.DTOs;

public class OverrideScheduleRequest
{
    public DateTime? TahiStartTime { get; set; }
    public DateTime? SalangStartTime { get; set; }
    public DateTime? PackagingStartTime { get; set; }
    public DateTime? RiderDepartureTime { get; set; }
    public DateTime? DepartureTime { get; set; }
    public string? RiderName { get; set; }
    public string? Remarks { get; set; }
}
