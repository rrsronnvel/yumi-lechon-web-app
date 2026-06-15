using System;
using System.Collections.Generic;

namespace LechonSystem.Api.Models
{
    public enum POStatus
    {
        Draft,
        Submitted,
        Fulfilled
    }

    public enum FulfillmentMethod
    {
        SupplierDelivery,
        StaffPickup
    }

    public class PurchaseOrder : BaseEntity
    {
        public int Id { get; set; }
        public string SupplierName { get; set; } = string.Empty;
        public DateTime OrderDate { get; set; }
        public DateTime ExpectedFulfillmentDate { get; set; }
        public POStatus Status { get; set; } = POStatus.Draft;
        public FulfillmentMethod Method { get; set; } = FulfillmentMethod.SupplierDelivery;

        // Navigation property for the line items
        public List<PurchaseOrderItem> OrderItems { get; set; } = new();
    }
}