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
        BankTransfer,
        Maya
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
        public int Id { get; set; }
        public int OrderId { get; set; }
        
        // This is our shield against duplicate payments
        public string GatewayReferenceId { get; set; } = string.Empty; 
        
        public PaymentProvider Provider { get; set; }

        public string PaymentMethod { get; set; } = "Cash";
        
        public decimal Amount { get; set; }
        
        public PaymentStatus Status { get; set; }

        public bool IsVoided { get; set; } = false;
        public DateTime? VoidedAt { get; set; }
        public string? VoidedBy { get; set; }
        public string? VoidReason { get; set; }
        
        // Navigation property linking back to the master order
        public Order? Order { get; set; }
    }

    public static class PaymentChannels
    {
        public static readonly string[] Supported = ["Cash", "GCash", "Maya", "Bank Transfer"];

        public static string Normalize(string? paymentMethod, string fallback = "Cash")
        {
            if (string.IsNullOrWhiteSpace(paymentMethod)) return fallback;

            var value = paymentMethod.Trim();
            if (value.Equals("Cash", StringComparison.OrdinalIgnoreCase) ||
                value.Equals("Physical Cash", StringComparison.OrdinalIgnoreCase))
                return "Cash";
            if (value.Contains("GCash", StringComparison.OrdinalIgnoreCase) ||
                value.Equals("ManualGCash", StringComparison.OrdinalIgnoreCase))
                return "GCash";
            if (value.Contains("Maya", StringComparison.OrdinalIgnoreCase))
                return "Maya";
            if (value.Contains("Bank", StringComparison.OrdinalIgnoreCase))
                return "Bank Transfer";

            return fallback;
        }

        public static PaymentProvider ToProvider(string? paymentMethod)
        {
            return Normalize(paymentMethod) switch
            {
                "GCash" => PaymentProvider.ManualGCash,
                "Maya" => PaymentProvider.Maya,
                "Bank Transfer" => PaymentProvider.BankTransfer,
                _ => PaymentProvider.Cash
            };
        }

        public static string FromProvider(PaymentProvider provider)
        {
            return provider switch
            {
                PaymentProvider.ManualGCash or PaymentProvider.GCash or PaymentProvider.PayMongo => "GCash",
                PaymentProvider.Maya => "Maya",
                PaymentProvider.BankTransfer => "Bank Transfer",
                _ => "Cash"
            };
        }
    }
}
