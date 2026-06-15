using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.Interfaces; // Or wherever your interface lives

namespace LechonSystem.Api.Services
{
    public class ProcurementService : IProcurementService
    {
        private readonly LechonDbContext _context;

        public ProcurementService(LechonDbContext context)
        {
            _context = context;
        }

        public async Task<List<LowStockAlert>> GetLowStockAlertsAsync()
        {
            var alerts = new List<LowStockAlert>();
            var categories = await _context.ItemCategories.ToListAsync();

            foreach (var category in categories)
            {
                // 1. Calculate real-time physical stock from the ledger
                var totalIn = await _context.InventoryTransactions
                    .Where(t => t.ItemCategoryId == category.Id && t.Type == TransactionType.StockIn)
                    .SumAsync(t => t.Quantity);

                var totalOut = await _context.InventoryTransactions
                    .Where(t => t.ItemCategoryId == category.Id && t.Type == TransactionType.StockOut)
                    .SumAsync(t => t.Quantity);

                var currentStock = totalIn - totalOut;

                // 2. The Check Engine Light Rule: Does our stock fall below the safety line?
                // Also ensures we only alert if a safety stock is actually configured (> 0)
                if (category.MinimumSafetyStock > 0 && currentStock < category.MinimumSafetyStock)
                {
                    alerts.Add(new LowStockAlert
                    {
                        ItemCategoryId = category.Id,
                        CategoryName = category.Name,
                        CurrentStock = currentStock,
                        MinimumSafetyStock = category.MinimumSafetyStock
                    });
                }
            }

            return alerts;
        }

        public async Task<PurchaseOrder?> GenerateDraftPurchaseOrderAsync(string supplierName, FulfillmentMethod fulfillmentMethod)
        {
            // 1. Ask our own method what we are short on
            var shortages = await GetLowStockAlertsAsync();

            // 2. If nothing is short, we don't need to buy anything!
            if (!shortages.Any())
            {
                return null;
            }

            // 3. Create the Master Clipboard (The PO)
            var purchaseOrder = new PurchaseOrder
            {
                SupplierName = supplierName,
                OrderDate = DateTime.UtcNow,
                ExpectedFulfillmentDate = DateTime.UtcNow.AddDays(3), // Defaulting to 3 days from now
                Status = POStatus.Draft,
                Method = fulfillmentMethod
            };

            // 4. Write the individual lines on the clipboard
            foreach (var item in shortages)
            {
                purchaseOrder.OrderItems.Add(new PurchaseOrderItem
                {
                    ItemCategoryId = item.ItemCategoryId,
                    QuantityRequested = item.SuggestedReorderQuantity
                });
            }

            // 5. Save the whole package to the database
            _context.PurchaseOrders.Add(purchaseOrder);
            await _context.SaveChangesAsync();

            return purchaseOrder;
        }
    }
}