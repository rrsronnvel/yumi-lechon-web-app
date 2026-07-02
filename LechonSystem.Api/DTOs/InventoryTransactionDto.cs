using System;

namespace LechonSystem.Api.DTOs
{
    public class InventoryTransactionDto
    {
        public int Id { get; set; }
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
        public string Type { get; set; } = string.Empty; // "StockIn", "StockOut", or "Adjustment"
        public string? Reason { get; set; }
        public int? ReferenceId { get; set; }
        public DateTime TransactionDate { get; set; }
    }
}