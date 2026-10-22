using System;
using System.Threading.Tasks;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Services;

public interface ISchedulingService
{
    Task<OrderItemSchedule> CalculateScheduleAsync(int orderItemId, DateTime targetDeliveryTime, int itemCategoryId, DateTime? riderDepartureTime = null);
    Task<object> GetDailyRosterAsync(DateTime targetDate);
    Task<System.Collections.Generic.List<DailySheetItemDto>> GetDailySheetsAsync(DateTime targetDate);
    Task<OrderItemSchedule> OverrideScheduleItemAsync(int orderItemId, OverrideScheduleRequest request);
}
