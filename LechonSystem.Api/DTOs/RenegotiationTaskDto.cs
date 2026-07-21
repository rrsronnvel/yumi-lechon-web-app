public class RenegotiationTaskDto
{
    public int OrderId { get; set; }
    public string CustomerName { get; set; }
    public DateTime TargetDeliveryTime { get; set; }
    
    // We can just calculate the total gap so the admin knows exactly how much they are losing
    public decimal PriceGap { get; set; } 
}