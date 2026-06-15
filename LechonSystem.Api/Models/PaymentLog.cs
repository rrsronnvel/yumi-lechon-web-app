using System;

namespace LechonSystem.Api.Models
{
    // The ways people can pay (both automated and manual)
    public enum PaymentProvider
    {
        Cash,
        ManualGCash,
        GCash,       // For future automated webhooks
        PayMongo,    // For future automated webhooks
        BankTransfer
    }

    // The state of the transaction
    public enum PaymentStatus
    {
        Pending,
        Success,
        Failed
    }

    public class PaymentLog : BaseEntity
    {
        public int OrderId { get; set; }
        
        // This is our shield against duplicate payments
        public string GatewayReferenceId { get; set; } = string.Empty; 
        
        public PaymentProvider Provider { get; set; }
        
        public decimal Amount { get; set; }
        
        public PaymentStatus Status { get; set; }
        
        // Navigation property linking back to the master order
        public Order? Order { get; set; }
    }
}