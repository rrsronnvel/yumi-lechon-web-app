using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services
{
    public interface ILogisticsService
    {
        Task<IEnumerable<Order>> GetUnassignedDeliveryOrdersAsync();
        Task<DeliveryTrip> AssignRiderAsync(string riderName, string vehicleType, List<int> orderIds);
        Task<IEnumerable<object>> GetTodayDispatchesAsync();
        Task<IEnumerable<object>> GetPendingSettlementDropsAsync();

        Task<IEnumerable<PendingPickupSettlementDto>> GetPendingPickupSettlementsAsync();
        Task<IEnumerable<PendingLalamoveSettlementDto>> GetPendingLalamoveSettlementsAsync();
        Task<bool> ConfirmLalamoveReleaseAsync(int orderId);
    }
}