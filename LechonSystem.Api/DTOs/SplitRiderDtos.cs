using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace LechonSystem.Api.DTOs;

public sealed class AssignOrderRidersRequest
{
    private string? _riderName;
    private string? _supportRiderName;

    [MaxLength(150)]
    public string? RiderName
    {
        get => _riderName;
        set
        {
            _riderName = value;
            RiderNameSpecified = true;
        }
    }

    [MaxLength(150)]
    public string? SupportRiderName
    {
        get => _supportRiderName;
        set
        {
            _supportRiderName = value;
            SupportRiderNameSpecified = true;
        }
    }

    public decimal? SupportRiderFee { get; set; }
    public int? SupportRiderHeads { get; set; }
    [JsonIgnore]
    public bool RiderNameSpecified { get; private set; }
    [JsonIgnore]
    public bool SupportRiderNameSpecified { get; private set; }
}

public sealed class AssignScheduleRiderRequest
{
    [JsonRequired, MaxLength(150)]
    public string? AssignedRiderName { get; set; }
}
