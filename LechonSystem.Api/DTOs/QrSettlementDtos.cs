namespace LechonSystem.Api.DTOs;

public class CreateQrSessionRequest
{
    public int OrderId { get; set; }
    public string HopStage { get; set; } = "RiderToStaff"; // "RiderToStaff" | "StaffToOwner"
    public string PaymentMethod { get; set; } = "Cash";
    public decimal ExpectedAmount { get; set; }
    public string? ReferenceNumber { get; set; }
}

public class QrSessionStatusDto
{
    public string Token { get; set; } = string.Empty;
    public int OrderId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string AssignedRiderName { get; set; } = string.Empty;
    public string HopStage { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal ExpectedAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? RiderSignedBy { get; set; }
    public decimal? RiderRemittedAmount { get; set; }
    public DateTime? RiderSignedAt { get; set; }
    public string? StaffValidatedBy { get; set; }
    public DateTime? StaffValidatedAt { get; set; }
    public string? OwnerApprovedBy { get; set; }
    public DateTime? OwnerApprovedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsExpired => DateTime.UtcNow > ExpiresAt && Status == "PendingScan";
    public bool IsUsed { get; set; }
    public bool WasRejected { get; set; }
}

public class RiderSignRequest
{
    public string RiderName { get; set; } = string.Empty;
    public decimal RemittedAmount { get; set; }
}

public class StaffValidateRequest
{
    public string? ManualOverrideRiderName { get; set; }
    public decimal? ManualOverrideAmount { get; set; }
}

public class OwnerApproveRequest
{
    public decimal CountedAmount { get; set; }
    public string? OwnerUsername { get; set; }
    public string? OwnerPinOrPassword { get; set; }
}

public class CounterCollectRequest
{
    public int OrderId { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public decimal? Amount { get; set; }
    public string? ReferenceNumber { get; set; }
}

public class SettleDirectGcashRequest
{
    public int OrderId { get; set; }
    public decimal Amount { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
}
