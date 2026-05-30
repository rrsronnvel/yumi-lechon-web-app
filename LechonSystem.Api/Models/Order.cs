namespace LechonSystem.Api.Models;

public class Order : BaseEntity
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty; // e.g., "Facebook Messenger", "Walk-In"
    
    // The anchor for our backward scheduling math
    public DateTime TargetDeliveryTime { get; set; } 
    
    // Our human-error prevention check flag
    public bool IsDeliveryDetailsConfirmed { get; set; } = false; 
    
    // Navigation property for the sub-items
    public List<OrderItem> OrderItems { get; set; } = new();
}