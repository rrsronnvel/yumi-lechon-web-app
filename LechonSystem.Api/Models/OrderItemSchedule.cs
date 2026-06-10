using System;
using System.Text.Json.Serialization;

namespace LechonSystem.Api.Models
{
    public class OrderItemSchedule : BaseEntity
    {
        public int Id { get; set; }

        public int OrderItemId { get; set; }
        
        // Navigation property linking back to the specific item
        [JsonIgnore]
        public OrderItem? OrderItem { get; set; }

        public DateTime TargetDeliveryTime { get; set; }
        public DateTime PackagingStartTime { get; set; }
        public DateTime SalangStartTime { get; set; }
        public DateTime TahiStartTime { get; set; }


        // --- NEW: Live Execution Tracking Timestamps ---
    public ProductionStatus CurrentStatus { get; set; } = ProductionStatus.Defrosting;
    public DateTime? ActualPreppingStartTime { get; set; }
    public DateTime? ActualSalangTime { get; set; }
    public DateTime? ActualPackagingTime { get; set; }
    public DateTime? ActualReadyForDeliveryTime { get; set; }
    }
}