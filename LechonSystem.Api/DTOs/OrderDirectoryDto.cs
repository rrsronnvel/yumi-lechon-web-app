namespace LechonSystem.Api.Models.DTOs
{
    public class OrderDirectoryDto
    {
        public int Id { get; set; } // We need this so the frontend can click to edit!
        public string CustomerName { get; set; } = string.Empty;
        public DateTime TargetDeliveryTime { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        
        // You can add other flat fields your Shadcn Data Table will need:
        public string ContactNumber { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
    }
}