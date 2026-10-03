namespace LechonSystem.Api.DTOs;

public class ReceiveStockRequest
{
    public int? PurchaseOrderId { get; set; }
    public string? SupplierDrNumber { get; set; }
    public string? Notes { get; set; }
    public List<ReceiveStockItemDto> Items { get; set; } = new();
}

public class ReceiveStockItemDto
{
    public int ItemCategoryId { get; set; }
    public int Quantity { get; set; }
}

public class ReceiveStockResponseDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int? FulfilledPoId { get; set; }
    public int TotalCarcassesReceived { get; set; }
}
