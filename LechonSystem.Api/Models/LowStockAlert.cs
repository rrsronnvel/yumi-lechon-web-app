namespace LechonSystem.Api.Models
{
    public class LowStockAlert
    {
        public int ItemCategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public int CurrentStock { get; set; }
        public int MinimumSafetyStock { get; set; }
        
        // Smart Property: Automatically calculates how many we need to buy to get back to safety
        public int SuggestedReorderQuantity => MinimumSafetyStock - CurrentStock; 
    }
}