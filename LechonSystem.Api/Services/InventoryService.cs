using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services
{
    public interface IInventoryService
    {
        Task ReleaseReservationAsync(int orderId);
        Task CreatePendingReservationAsync(int orderId, int itemCategoryId, DateTime reservationDate, bool isTrustedCustomer, decimal downpayment);

        // ADDED: reason parameter
        Task LogTransactionAsync(int itemCategoryId, int quantity, TransactionType type, int? referenceId = null, string? reason = null);

        Task<int> GetAvailableStockAsync(int itemCategoryId, DateTime date);

        // NEW: Fetch the entire ledger history
        Task<List<LechonSystem.Api.DTOs.InventoryTransactionDto>> GetTransactionLedgerAsync();

        Task<IEnumerable<InventoryBalanceDto>> GetLiveBalancesAsync();
    }

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
                Status = initialStatus
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
                         && r.Status == ReservationStatus.Committed)
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
                    
                    // FIX: Update this line from 'Type =' to 'TransactionType ='
                    TransactionType = t.Type.ToString(), 
                    
                    Reason = t.Reason,
                    ReferenceId = t.ReferenceId,
                    TransactionDate = t.TransactionDate
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<InventoryBalanceDto>> GetLiveBalancesAsync()
        {
            // We ask SQL to look at the categories, and for every category, 
            // instantly calculate the Sum of Stock In minus the Sum of Stock Out/Adjustments
            var balances = await _context.ItemCategories
                .Select(cat => new InventoryBalanceDto
                {
                    Id = cat.Id,
                    Name = cat.Name,
                    MinimumSafetyStock = cat.MinimumSafetyStock,
                    CurrentStock = _context.InventoryTransactions
                        .Where(t => t.ItemCategoryId == cat.Id)
                        .Sum(t => t.Type == TransactionType.StockIn ? t.Quantity : -t.Quantity)
                    // Adds StockIn, subtracts everything else!
                })
                .AsNoTracking()
                .ToListAsync();

            return balances;
        }
    }
}