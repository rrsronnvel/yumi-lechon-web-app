namespace LechonSystem.Api.Models;

public class OrderItem : BaseEntity
{
    public int Id { get; set; }
    public int OrderId { get; set; } // Foreign Key to Master Order
    public Order? Order { get; set; } // Navigation property
    
    public int ItemCategoryId { get; set; } // Foreign Key to the specific size bucket
    public ItemCategory? ItemCategory { get; set; } // Navigation property
    
    public int Quantity { get; set; }
    public decimal TotalPrice { get; set; }
}