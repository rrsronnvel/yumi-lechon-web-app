using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace LechonSystem.Api.Models.DTOs
{
    public class UpdateOrderDto
    {
        // 1. The Anchor (Which order are we editing?)
        public int Id { get; set; }
        public bool IsDraft { get; set; } = false;
        public bool IsTimeTbd { get; set; } = false;

        // 2. Customer & Routing Details
        public string CustomerName { get; set; } = string.Empty;
        public string? FacebookName { get; set; }
        public string ContactNumber { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public string? EventType { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? Landmark { get; set; }
        public string? Remarks { get; set; }
        public string? AssignedRiderName { get; set; }
        public string? UpdatedBy { get; set; }
        public string? AssistedByAdmin { get; set; }
        public DateTime? TargetDeliveryTime { get; set; }
        public DateTime? RiderDepartureTime { get; set; }
        [MaxLength(50)]
        public string? KitchenBranch { get; set; }
        [JsonIgnore]
        public bool KitchenBatchCodeSpecified { get; private set; }
        private string? _kitchenBatchCode;
        [MaxLength(50)]
        public string? KitchenBatchCode
        {
            get => _kitchenBatchCode;
            set
            {
                KitchenBatchCodeSpecified = true;
                _kitchenBatchCode = value;
            }
        }
        public bool CapacityOverrideApproved { get; set; }
        [MaxLength(250)]
        public string? CapacityOverrideReason { get; set; }
        public FulfillmentType Fulfillment { get; set; }

        // 3. Financials
        public decimal Price { get; set; }
        public string? AddOns { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal Downpayment { get; set; }
        public string DownpaymentMethod { get; set; } = "None";
        public string? FreebiesSummary { get; set; }
        public string? FreebiesConfigJson { get; set; }
        public string? PromoPackageCode { get; set; }
        public string? PromoPackageLabel { get; set; }
        public bool IsOwnerConfirmed { get; set; }
        public DateTime? OwnerConfirmedAt { get; set; }
        public string? OwnerConfirmedBy { get; set; }
        public decimal Discount { get; set; }
        public decimal GrandTotal { get; set; }

        // 4. The Order Items (Needed so we can see if they changed the Lechon Size!)
        public List<UpdateOrderItemDto> Items { get; set; } = new();
    }

    // A small helper class to carry the edited items
    public class UpdateOrderItemDto
    {
        public int Id { get; set; } // The ID of the existing order item (0 if it's a brand new item added during edit)
        public int ItemCategoryId { get; set; }
        public int? FulfilledItemCategoryId { get; set; }
        public int Quantity { get; set; }
    }
}
