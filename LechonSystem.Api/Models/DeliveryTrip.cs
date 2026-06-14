using System;
using System.Collections.Generic;

namespace LechonSystem.Api.Models
{
    public class DeliveryTrip : BaseEntity
    {

        public int Id { get; set; }
        public string RiderName { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty; 
        public DeliveryStatus Status { get; set; } = DeliveryStatus.Unassigned;
        
        public DateTime? DispatchTime { get; set; }
        public DateTime? ActualReturnTime { get; set; }

        // Navigation property: One trip can contain multiple orders
        public ICollection<Order> Orders { get; set; } = new List<Order>();
    }
}