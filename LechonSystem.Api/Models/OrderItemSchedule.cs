using System;
using System.Text.Json.Serialization;

namespace LechonSystem.Api.Models
{
    public class OrderItemSchedule : BaseEntity
    {
        public int Id { get; set; }

        public int OrderItemId { get; set; }
        public int UnitIndex { get; set; } = 1;
        public int UnitTotal { get; set; } = 1;
        
        // Navigation property linking back to the specific item
        [JsonIgnore]
        public OrderItem? OrderItem { get; set; }

        public DateTime TargetDeliveryTime { get; set; }
        public DateTime PackagingStartTime { get; set; }
        public DateTime SalangStartTime { get; set; }
        public DateTime TahiStartTime { get; set; }
        public string? CustomWeightDisplay { get; set; }
        [System.ComponentModel.DataAnnotations.MaxLength(150)]
        public string? AssignedRiderName { get; set; }


        public bool IsManualOverride { get; set; } = false;

        // --- NEW: Live Execution Tracking Timestamps ---
        public ProductionStatus CurrentStatus { get; set; } = ProductionStatus.Defrosting;
        public DateTime? ActualPreppingStartTime { get; set; }
        public DateTime? ActualSalangTime { get; set; }
        public DateTime? ActualPackagingTime { get; set; }
        public DateTime? ActualReadyForDeliveryTime { get; set; }
    }
}
