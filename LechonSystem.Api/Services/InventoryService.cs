using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public interface IInventoryService
    {
        Task<InventoryReservation> CreatePendingReservationAsync(int orderId, int itemCategoryId, DateTime reservationDate);
        Task CommitReservationAsync(int reservationId);
    }

    public class InventoryService : IInventoryService
    {
        private readonly LechonDbContext _context;

        public InventoryService(LechonDbContext context)
        {
            _context = context;
        }

        // Action Item: Default new reservations to Pending
        public async Task<InventoryReservation> CreatePendingReservationAsync(int orderId, int itemCategoryId, DateTime reservationDate)
        {
            var reservation = new InventoryReservation
            {
                OrderId = orderId,
                ItemCategoryId = itemCategoryId,
                ReservationDate = reservationDate,
                Status = ReservationStatus.Pending // The State Machine starts here
            };

            _context.InventoryReservations.Add(reservation);
            await _context.SaveChangesAsync();

            return reservation;
        }

        // Action Item: Transition them to Committed when downpayment is verified
        public async Task CommitReservationAsync(int reservationId)
        {
            var reservation = await _context.InventoryReservations.FindAsync(reservationId);
            
            // Safety Check: Only lock it if it actually exists and is currently Pending
            if (reservation != null && reservation.Status == ReservationStatus.Pending)
            {
                reservation.Status = ReservationStatus.Committed; // The State Transition
                await _context.SaveChangesAsync();
            }
        }
    }
}