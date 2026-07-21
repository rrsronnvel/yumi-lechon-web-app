using System;

namespace LechonSystem.Api.Models
{
    public class OrderAuditLog : BaseEntity
    {

        public int Id { get; set; } // Primary key for the audit log entry

        // Links this log to a specific receipt/order
        public int OrderId { get; set; } 
        
        // e.g., "Edited", "Cancelled", "Price Waived"
        public string ActionType { get; set; } = string.Empty; 
        
        // The human-readable diff (e.g., "Size changed from Medium to Large")
        public string Changes { get; set; } = string.Empty; 
        
        // Who made the change (we will use a placeholder for now)
        public string ChangedBy { get; set; } = string.Empty; 
        
        // The exact moment the edit was saved 
        public DateTime Timestamp { get; set; } = DateTime.UtcNow; 
    }
}