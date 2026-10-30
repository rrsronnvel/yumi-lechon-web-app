using LechonSystem.Api.Common;
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services
{
    public class InventoryService : IInventoryService
    {
        private readonly LechonDbContext _context;

        public InventoryService(LechonDbContext context)
        {
            _context = context;
        }

        // --- Your existing Reservation State Machine Logic ---
        public async Task CreatePendingReservationAsync(int orderId, int itemCategoryId, DateTime reservationDate, bool isTrustedCustomer, decimal downpayment)
        {
            // 1. Default to Pending (Normal Reservation waiting for GCash)
            ReservationStatus initialStatus = ReservationStatus.Pending; // (Or PendingPayment if that is your exact Enum name)

            // 2. The Unified Rule: If they paid cash upfront, OR the admin checked the VIP box, lock the pig!
            if (downpayment > 0 || isTrustedCustomer)
            {
                initialStatus = ReservationStatus.Committed;
            }

            // 3. Create the reservation using our calculated status
            var reservation = new InventoryReservation
            {
                OrderId = orderId,
                ItemCategoryId = itemCategoryId,
                ReservationDate = reservationDate,
                Status = initialStatus,
                ReservationStatus = initialStatus
            };

            _context.InventoryReservations.Add(reservation);
            await _context.SaveChangesAsync();
        }

        // --- New Action Item 1: Log a Ledger Movement ---
        public async Task LogTransactionAsync(int itemCategoryId, int quantity, TransactionType type, int? referenceId = null, string? reason = null)
        {
            // THE BOUNCER: Block manual adjustments if the staff didn't type a reason!
            if (type == TransactionType.Adjustment && string.IsNullOrWhiteSpace(reason))
            {
                throw new ArgumentException("A reason must be provided for manual inventory adjustments.");
            }

            var transaction = new InventoryTransaction
            {
                ItemCategoryId = itemCategoryId,
                Quantity = quantity,
                Type = type,
                ReferenceId = referenceId,
                TransactionDate = DateTime.UtcNow,
                Reason = reason // Hook up the new property!
            };

            _context.InventoryTransactions.Add(transaction);
            await _context.SaveChangesAsync();
        }

        // --- New Action Item 2: Calculate Real-Time Stock Balance ---
        public async Task<int> GetAvailableStockAsync(int itemCategoryId, DateTime date)
        {
            // 1. Calculate Physical On-Hand Stock from the Append-Only Ledger
            var totalStockIn = await _context.InventoryTransactions
                .Where(t => t.ItemCategoryId == itemCategoryId && (t.Type == TransactionType.StockIn || t.Type == TransactionType.Adjustment))
                .SumAsync(t => t.Quantity);

            var totalStockOut = await _context.InventoryTransactions
                .Where(t => t.ItemCategoryId == itemCategoryId && t.Type == TransactionType.StockOut)
                .SumAsync(t => t.Quantity);

            int physicalOnHand = totalStockIn - totalStockOut;

            // 2. Calculate Promised/Locked Stock for this target date
            int totalCommittedReservations = await _context.InventoryReservations
                .Where(r => r.ItemCategoryId == itemCategoryId
                         && r.ReservationDate.Date == date.Date
                         && (r.Status == ReservationStatus.Committed || r.ReservationStatus == ReservationStatus.Committed))
                .CountAsync();

            // 3. Subtract promised stock from physical stock to get the absolute truth
            return physicalOnHand - totalCommittedReservations;
        }

        public async Task ReleaseReservationAsync(int orderId)
        {
            // Find the locked pig ticket
            var reservation = await _context.InventoryReservations
                .FirstOrDefaultAsync(r => r.OrderId == orderId);

            // If it exists, rip up the ticket!
            if (reservation != null)
            {
                _context.InventoryReservations.Remove(reservation);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<List<LechonSystem.Api.DTOs.InventoryTransactionDto>> GetTransactionLedgerAsync()
        {
            return await _context.InventoryTransactions
                .AsNoTracking()
                .OrderByDescending(t => t.TransactionDate)
                .Select(t => new LechonSystem.Api.DTOs.InventoryTransactionDto
                {
                    Id = t.Id,
                    ItemCategoryId = t.ItemCategoryId,
                    Quantity = t.Quantity,
                    TransactionType = t.Type.ToString(), 
                    Reason = t.Reason,
                    ReferenceId = t.ReferenceId,
                    TransactionDate = t.TransactionDate
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<InventoryBalanceDto>> GetInventoryBalancesAsync()
        {
            var categories = await _context.ItemCategories
                .AsNoTracking()
                .Where(c => c.MinimumWeightKg > 0 || c.MaximumWeightKg > 0)
                .ToListAsync();

            // 1. Calculate Physical Stock per category:
            // Sum(StockIn + Positive Adjustments) - Sum(StockOut + Negative Adjustments)
            var transactions = await _context.InventoryTransactions
                .AsNoTracking()
                .ToListAsync();

            var physicalStockMap = transactions
                .GroupBy(t => t.ItemCategoryId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Sum(t =>
                    {
                        if (t.Type == TransactionType.StockIn)
                            return Math.Abs(t.Quantity);
                        if (t.Type == TransactionType.StockOut)
                            return -Math.Abs(t.Quantity);
                        // Adjustment: positive adds, negative subtracts
                        return t.Quantity;
                    })
                );

            // 2. Calculate Locked Stock (14-Day Forward Window):
            // Committed holds from InventoryReservations linked to Order where:
            // - ReservationStatus == Committed
            // - Order.IsCancelled == false
            // - Order.TargetDeliveryTime >= DateTime.Today and Order.TargetDeliveryTime < DateTime.Today.AddDays(15)
            var windowStart = PhilippineTime.Today;
            var windowEnd = windowStart.AddDays(15);

            var reservations = await _context.InventoryReservations
                .AsNoTracking()
                .Include(r => r.Order)
                .Where(r => (r.Status == ReservationStatus.Committed || r.ReservationStatus == ReservationStatus.Committed)
                         && r.Order != null
                         && !r.Order.IsCancelled
                         && r.Order.TargetDeliveryTime >= windowStart
                         && r.Order.TargetDeliveryTime < windowEnd)
                .ToListAsync();

            var lockedStockMap = reservations
                .GroupBy(r => r.ItemCategoryId)
                .ToDictionary(g => g.Key, g => g.Count());

            // 3. Health status evaluation & DTO construction
            var balances = categories.Select(cat =>
            {
                int physicalStock = physicalStockMap.GetValueOrDefault(cat.Id, 0);
                int lockedStock = lockedStockMap.GetValueOrDefault(cat.Id, 0);
                int availableStock = physicalStock - lockedStock;

                string healthStatus;
                if (availableStock > cat.MinimumSafetyStock)
                {
                    healthStatus = "Optimal";
                }
                else if (availableStock >= 0)
                {
                    healthStatus = "Low Stock";
                }
                else
                {
                    healthStatus = "Deficit";
                }

                return new InventoryBalanceDto
                {
                    CategoryId = cat.Id,
                    CategoryName = cat.Name,
                    WeightRangeDisplay = $"{cat.MinimumWeightKg:0.0}–{cat.MaximumWeightKg:0.0} kg",
                    PhysicalStock = physicalStock,
                    LockedStock = lockedStock,
                    AvailableStock = availableStock,
                    MinimumSafetyStock = cat.MinimumSafetyStock,
                    HealthStatus = healthStatus
                };
            }).ToList();

            return balances;
        }

        public async Task<IEnumerable<InventoryBalanceDto>> GetLiveBalancesAsync()
        {
            return await GetInventoryBalancesAsync();
        }

        public async Task<ReceiveStockResponseDto> ReceiveStockAsync(ReceiveStockRequest request)
        {
            if (request == null)
            {
                throw new ArgumentException("Request payload cannot be null.");
            }

            if (request.Items == null || !request.Items.Any())
            {
                throw new ArgumentException("At least one stock item must be received.");
            }

            if (request.Items.Any(i => i.Quantity <= 0))
            {
                throw new ArgumentException("All received items must have a quantity greater than zero.");
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();

            int? fulfilledPoId = null;
            if (request.PurchaseOrderId.HasValue && request.PurchaseOrderId.Value > 0)
            {
                var po = await _context.PurchaseOrders
                    .Include(p => p.OrderItems)
                    .FirstOrDefaultAsync(p => p.Id == request.PurchaseOrderId.Value);

                if (po == null)
                {
                    throw new KeyNotFoundException($"Purchase Order #{request.PurchaseOrderId.Value} was not found.");
                }

                po.Status = POStatus.Fulfilled;
                po.UpdatedAt = DateTime.UtcNow;
                fulfilledPoId = po.Id;
            }

            var categoryIds = request.Items.Select(i => i.ItemCategoryId).Distinct().ToList();
            var existingCategoryIds = await _context.ItemCategories
                .Where(c => categoryIds.Contains(c.Id))
                .Select(c => c.Id)
                .ToListAsync();

            foreach (var catId in categoryIds)
            {
                if (!existingCategoryIds.Contains(catId))
                {
                    throw new KeyNotFoundException($"Item category #{catId} was not found.");
                }
            }

            var drPart = !string.IsNullOrWhiteSpace(request.SupplierDrNumber) ? $"DR: {request.SupplierDrNumber.Trim()}" : "No DR";
            var notesPart = !string.IsNullOrWhiteSpace(request.Notes) ? $" | Notes: {request.Notes.Trim()}" : "";
            var reason = fulfilledPoId.HasValue
                ? $"[Freezer Intake via PO #{fulfilledPoId.Value}] {drPart}{notesPart}"
                : $"[Direct Freezer Intake] {drPart}{notesPart}";

            int totalCarcassesReceived = 0;

            foreach (var item in request.Items)
            {
                var ledgerEntry = new InventoryTransaction
                {
                    ItemCategoryId = item.ItemCategoryId,
                    Quantity = item.Quantity,
                    Type = TransactionType.StockIn,
                    TransactionDate = DateTime.UtcNow,
                    Reason = reason,
                    ReferenceId = fulfilledPoId
                };

                _context.InventoryTransactions.Add(ledgerEntry);
                totalCarcassesReceived += item.Quantity;
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return new ReceiveStockResponseDto
            {
                Success = true,
                Message = $"Successfully received {totalCarcassesReceived} carcass{(totalCarcassesReceived == 1 ? "" : "es")} into freezer stock.",
                FulfilledPoId = fulfilledPoId,
                TotalCarcassesReceived = totalCarcassesReceived
            };
        }
    }
}