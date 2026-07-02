namespace LechonSystem.Api.DTOs
{
    public class InventoryBalanceDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int MinimumSafetyStock { get; set; }
        public int CurrentStock { get; set; } // The magic number we've been missing!
    }
}