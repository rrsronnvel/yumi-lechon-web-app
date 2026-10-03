using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;

namespace LechonSystem.Api.Services;

public interface IInventoryService
{
    Task ReleaseReservationAsync(int orderId);
    Task CreatePendingReservationAsync(int orderId, int itemCategoryId, DateTime reservationDate, bool isTrustedCustomer, decimal downpayment);

    // ADDED: reason parameter
    Task LogTransactionAsync(int itemCategoryId, int quantity, TransactionType type, int? referenceId = null, string? reason = null);

    Task<int> GetAvailableStockAsync(int itemCategoryId, DateTime date);

    // Fetch the entire ledger history
    Task<List<InventoryTransactionDto>> GetTransactionLedgerAsync();

    Task<IEnumerable<InventoryBalanceDto>> GetInventoryBalancesAsync();
    Task<IEnumerable<InventoryBalanceDto>> GetLiveBalancesAsync();

    // Freezer-Gate Stock Intake & PO Fulfillment
    Task<ReceiveStockResponseDto> ReceiveStockAsync(ReceiveStockRequest request);
}
