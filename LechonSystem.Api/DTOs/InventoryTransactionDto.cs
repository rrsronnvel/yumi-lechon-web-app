namespace LechonSystem.Api.DTOs
{
    public class InventoryTransactionDto
    {
        public int Id { get; set; }
        public int ItemCategoryId { get; set; }
        public int Quantity { get; set; }
        
        // FIX: Rename 'Type' to 'TransactionType' to match React exactly!
        public string TransactionType { get; set; } = string.Empty; 
        
        public string? Reason { get; set; }
        public int? ReferenceId { get; set; }
        public DateTime TransactionDate { get; set; }
    }
}