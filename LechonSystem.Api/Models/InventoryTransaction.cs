using System;

namespace LechonSystem.Api.Models
{
    public class InventoryTransaction : BaseEntity
    {

        public int Id { get; set; }
        public DateTime TransactionDate { get; set; } = DateTime.UtcNow;
        public int ItemCategoryId { get; set; }
        public ItemCategory? ItemCategory { get; set; }
        public int Quantity { get; set; }
        public TransactionType Type { get; set; }
        
        // This links the transaction to a specific Order ID or Supplier Delivery ID
        public int? ReferenceId { get; set; } 
    }
}