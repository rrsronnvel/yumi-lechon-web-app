namespace LechonSystem.Api.Models
{
    public class PurchaseOrderItem : BaseEntity
    {
        public int Id { get; set; }
        public int PurchaseOrderId { get; set; }
        public PurchaseOrder PurchaseOrder { get; set; } = null!;

        public int ItemCategoryId { get; set; }
        public ItemCategory ItemCategory { get; set; } = null!;

        public int QuantityRequested { get; set; }
    }
}