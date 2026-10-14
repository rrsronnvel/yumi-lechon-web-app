namespace LechonSystem.Api.Models;

public class SettlementQrSession
{
    public int Id { get; set; }
    public string Token { get; set; } = Guid.NewGuid().ToString("N");
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public string HopStage { get; set; } = "RiderToStaff"; // "RiderToStaff" | "StaffToOwner"
    public string PaymentMethod { get; set; } = "Cash"; // "Cash" | "ManualGCash" | "GCash"
    public decimal ExpectedAmount { get; set; }
    public string? ReferenceNumber { get; set; }

    public string? RiderSignedBy { get; set; }
    public decimal? RiderRemittedAmount { get; set; }
    public DateTime? RiderSignedAt { get; set; }

    public string? StaffValidatedBy { get; set; }
    public DateTime? StaffValidatedAt { get; set; }

    public string? OwnerApprovedBy { get; set; }
    public DateTime? OwnerApprovedAt { get; set; }

    // "PendingScan" | "SignedByRider" | "ValidatedByStaff" | "ApprovedByOwner" | "Expired"
    public string Status { get; set; } = "PendingScan";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddMinutes(10);
    public bool IsUsed { get; set; } = false;
}
