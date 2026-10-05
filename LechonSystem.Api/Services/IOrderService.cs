using System.Collections.Generic;
using System.Threading.Tasks;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Models.DTOs;

namespace LechonSystem.Api.Services;

public interface IOrderService
{
    Task<Order> CreateOrderAsync(CreateOrderRequest request);
    Task<bool> ConfirmPaymentAsync(int orderId);
    Task<bool> ConfirmDeliveryDetailsAsync(int orderId);
    Task<bool> CancelOrderAsync(int orderId, string reason = "Cancelled by dispatcher");
    Task<List<OrderDirectoryDto>> GetOrderDirectoryAsync(string? searchTerm, string? filterTab);
    Task UpdateOrderAsync(int id, UpdateOrderDto request);
    Task<Order?> GetOrderByIdAsync(int orderId);
    Task<OrderDetailsDto?> GetOrderDetailsAsync(int orderId);
    Task<bool> ApplyNewMenuPricesAsync(int orderId);
    Task<bool> WaivePriceHikeAsync(int orderId);
    Task<List<OrderAuditLog>> GetOrderAuditLogsAsync(int orderId);
}
