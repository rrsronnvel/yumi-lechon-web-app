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
        Task<DeliveryTrip> AssignRiderToOrdersAsync(string riderName, string vehicleType, List<int> orderIds);
        Task<bool> UnassignRiderAsync(int orderId);
        Task<IEnumerable<object>> GetTodayDispatchesAsync();
        Task<IEnumerable<PendingSettlementDropDto>> GetPendingSettlementDropsAsync();

        Task<IEnumerable<PendingPickupSettlementDto>> GetPendingPickupSettlementsAsync();
        Task<IEnumerable<PendingLalamoveSettlementDto>> GetPendingLalamoveSettlementsAsync();
        Task<bool> ConfirmLalamoveReleaseAsync(int orderId);

        // Two-Hop QR Custody Chain
        Task<QrSessionStatusDto> CreateQrSessionAsync(CreateQrSessionRequest request);
        Task<QrSessionStatusDto?> GetQrSessionByTokenAsync(string token);
        Task<QrSessionStatusDto> RiderSignQrSessionAsync(string token, RiderSignRequest request);
        Task<QrSessionStatusDto> RejectRiderSignatureAsync(string token);
        Task<QrSessionStatusDto> StaffValidateQrSessionAsync(string token, StaffValidateRequest? request, string staffUsername);
        Task<QrSessionStatusDto> CounterCollectQrSessionAsync(string token, string staffUsername);
        Task<bool> CounterCollectPickupAsync(int orderId, string paymentMethod, string staffUsername, decimal? amount = null, string? referenceNumber = null);
        Task<bool> RevertCustodyAsync(int orderId, string currentUser, bool isOwner);
        Task<QrSessionStatusDto> OwnerApproveQrSessionAsync(string token, OwnerApproveRequest? request, string? currentUsername, bool isOwnerRole);
        Task<bool> SettleDirectStoreGcashAsync(int orderId, decimal amount, string referenceNumber, string staffUsername);
    }
}