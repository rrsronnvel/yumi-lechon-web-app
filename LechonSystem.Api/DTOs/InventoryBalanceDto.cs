namespace LechonSystem.Api.DTOs
{
    public class InventoryBalanceDto
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string WeightRangeDisplay { get; set; } = string.Empty;
        public int PhysicalStock { get; set; }
        public int LockedStock { get; set; }
        public int AvailableStock { get; set; }
        public int MinimumSafetyStock { get; set; }
        public string HealthStatus { get; set; } = "Optimal"; // "Optimal" | "Low Stock" | "Deficit"
    }
}