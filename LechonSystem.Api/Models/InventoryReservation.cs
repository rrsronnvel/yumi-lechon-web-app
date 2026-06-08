using System;

namespace LechonSystem.Api.Models
{
    public class InventoryReservation : BaseEntity
    {
        public int Id { get; set; }
        
        // The order this reservation belongs to
        public int OrderId { get; set; }
        public Order? Order { get; set; }

        // The specific weight bracket they reserved (e.g., Medium Whole)
        public int ItemCategoryId { get; set; }
        public ItemCategory? ItemCategory { get; set; }

        // The date the item is needed
        public DateTime ReservationDate { get; set; }

        // The current state of this reservation ticket
        public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    }
}