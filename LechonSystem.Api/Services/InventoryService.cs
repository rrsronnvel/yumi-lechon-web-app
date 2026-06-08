using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public interface IInventoryService
    {
        Task CreatePendingReservationAsync(int orderId, int itemCategoryId, DateTime reservationDate);
        Task LogTransactionAsync(int itemCategoryId, int quantity, TransactionType type, int? referenceId = null);
        Task<int> GetAvailableStockAsync(int itemCategoryId, DateTime date);
    }

    public class InventoryService : IInventoryService
    {
        private readonly LechonDbContext _context;

        public InventoryService(LechonDbContext context)
        {
            _context = context;
        }

        // --- Your existing Reservation State Machine Logic ---
        public async Task CreatePendingReservationAsync(int orderId, int itemCategoryId, DateTime reservationDate)
        {
            var reservation = new InventoryReservation
            {
                OrderId = orderId,
                ItemCategoryId = itemCategoryId,
                ReservationDate = reservationDate,
                Status = ReservationStatus.Pending
            };

            _context.InventoryReservations.Add(reservation);
            await _context.SaveChangesAsync();
        }

        // --- New Action Item 1: Log a Ledger Movement ---
        public async Task LogTransactionAsync(int itemCategoryId, int quantity, TransactionType type, int? referenceId = null)
        {
            var transaction = new InventoryTransaction
            {
                ItemCategoryId = itemCategoryId,
                Quantity = quantity,
                Type = type,
                ReferenceId = referenceId,
                TransactionDate = DateTime.UtcNow
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
    }
}