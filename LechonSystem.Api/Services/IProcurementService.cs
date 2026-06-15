using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Interfaces
{
    public interface IProcurementService
    {
        Task<List<LowStockAlert>> GetLowStockAlertsAsync();
        Task<PurchaseOrder?> GenerateDraftPurchaseOrderAsync(string supplierName, FulfillmentMethod fulfillmentMethod);
    }
}