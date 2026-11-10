using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.DTOs;
using LechonSystem.Api.Models;
using LechonSystem.Api.Common;

namespace LechonSystem.Api.Services
{
    public class SchedulingService : ISchedulingService
    {
        private readonly LechonDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IInventoryService _inventoryService;

        public SchedulingService(LechonDbContext context, IHttpContextAccessor httpContextAccessor, IInventoryService inventoryService)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _inventoryService = inventoryService;
        }

        private string CurrentUser => UserIdentityHelper.ResolveDisplayName(_httpContextAccessor?.HttpContext?.User, "Owner");

        public async Task<OrderItemSchedule> CalculateScheduleAsync(
            int orderItemId,
            DateTime targetDeliveryTime,
            int itemCategoryId,
            DateTime? riderDepartureTime = null)
        {
            FulfillmentType? fulfillment = null;
            if (orderItemId > 0)
            {
                var orderContext = await _context.OrderItems
                    .AsNoTracking()
                    .Where(item => item.Id == orderItemId)
                    .Select(item => new
                    {
                        EffectiveCategoryId = item.FulfilledItemCategoryId ?? item.ItemCategoryId,
                        DepartureTime = item.Order != null ? item.Order.RiderDepartureTime : null,
                        Fulfillment = item.Order != null ? (FulfillmentType?)item.Order.Fulfillment : null
                    })
                    .FirstOrDefaultAsync();
                if (orderContext != null)
                {
                    if (orderContext.EffectiveCategoryId > 0)
                    {
                        itemCategoryId = orderContext.EffectiveCategoryId;
                    }
                    riderDepartureTime ??= orderContext.DepartureTime;
                    fulfillment = orderContext.Fulfillment;
                }
            }

            var profile = await _context.ProductCookingProfiles
                .FirstOrDefaultAsync(p => p.ItemCategoryId == itemCategoryId);

            int tahiDuration = profile?.TahiDurationMinutes ?? 60;
            int salangDuration = profile?.SalangDurationMinutes ?? 180;
            int packagingDuration = profile?.PackagingDurationMinutes ?? 30;

            var target = NormalizeToLocalStoreTime(targetDeliveryTime);
            DateTime anchorTime;
            if (riderDepartureTime.HasValue)
            {
                // RiderDepartureTime is the kitchen zero-hour whenever it is present.
                // TargetDeliveryTime remains the independent customer serving time.
                anchorTime = NormalizeToLocalStoreTime(riderDepartureTime.Value);
            }
            else if (fulfillment == FulfillmentType.Pickup || fulfillment == FulfillmentType.Lalamove)
            {
                anchorTime = target;
            }
            else
            {
                anchorTime = target.AddHours(-1);
            }

            anchorTime = NormalizeToLocalStoreTime(anchorTime);

            DateTime packagingStart = anchorTime.AddMinutes(-packagingDuration);
            DateTime salangStart = packagingStart.AddMinutes(-salangDuration);
            DateTime tahiStart = salangStart.AddMinutes(-tahiDuration);

            var schedule = new OrderItemSchedule
            {
                OrderItemId = orderItemId,
                TargetDeliveryTime = target,
                PackagingStartTime = packagingStart,
                SalangStartTime = salangStart,
                TahiStartTime = tahiStart
            };

            return schedule;
        }

        public async Task<object> GetDailyRosterAsync(DateTime targetDate)
        {
            var dailySheets = await GetDailySheetsAsync(targetDate);
            return dailySheets.Items;
        }

        public async Task<DailySheetsResponseDto> GetDailySheetsAsync(DateTime? date = null)
        {
            var targetDate = (date ?? PhilippineTime.Today).Date;

            var roastItems = await _context.OrderItemSchedules
                .AsNoTracking()
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                        .ThenInclude(o => o!.DeliveryTrip)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.ItemCategory)
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.FulfilledItemCategory)
                .Where(s => s.OrderItem != null
                         && s.OrderItem.ItemCategory != null
                         && s.OrderItem.ItemCategory.MinimumWeightKg > 0
                         && s.OrderItem.Order != null
                         && !s.OrderItem.Order.IsDraft
                         && !s.OrderItem.Order.IsTimeTbd
                         && !s.OrderItem.Order.IsCancelled
                         && s.OrderItem.Order.TargetDeliveryTime.HasValue
                         && s.OrderItem.Order.TargetDeliveryTime.Value.Date == targetDate)
                .Select(s => new
                {
                    id = s.Id,
                    orderItemId = s.OrderItemId,
                    orderId = s.OrderItem!.OrderId,
                    orderReference = s.OrderItem!.Order!.OrderReference,
                    customerName = s.OrderItem!.Order!.CustomerName,
                    facebookName = s.OrderItem!.Order!.FacebookName,
                    contactNumber = s.OrderItem!.Order!.ContactNumber,
                    source = s.OrderItem!.Order!.Source,
                    eventType = s.OrderItem!.Order!.EventType,
                    landmark = s.OrderItem!.Order!.Landmark,
                    size = s.OrderItem!.FulfilledItemCategory != null
                        ? s.OrderItem.FulfilledItemCategory.Name
                        : s.OrderItem.ItemCategory!.Name,
                    categoryName = s.OrderItem!.FulfilledItemCategory != null
                        ? s.OrderItem.FulfilledItemCategory.Name
                        : s.OrderItem.ItemCategory!.Name,
                    bookedSizeName = s.OrderItem.FulfilledItemCategoryId.HasValue &&
                                     s.OrderItem.FulfilledItemCategoryId != s.OrderItem.ItemCategoryId
                        ? s.OrderItem.ItemCategory!.Name
                        : null,
                    bookedItemCategoryId = s.OrderItem.ItemCategoryId,
                    fulfilledItemCategoryId = s.OrderItem.FulfilledItemCategoryId,
                    minWeight = s.OrderItem.FulfilledItemCategory != null
                        ? s.OrderItem.FulfilledItemCategory.MinimumWeightKg
                        : s.OrderItem.ItemCategory!.MinimumWeightKg,
                    maxWeight = s.OrderItem.FulfilledItemCategory != null
                        ? s.OrderItem.FulfilledItemCategory.MaximumWeightKg
                        : s.OrderItem.ItemCategory!.MaximumWeightKg,
                    customWeightDisplay = s.CustomWeightDisplay,

                    // TIMINGS
                    targetDeliveryTime = (DateTime?)s.TargetDeliveryTime,
                    riderDepartureTime = s.OrderItem!.Order!.RiderDepartureTime,
                    tahiStartTime = (DateTime?)s.TahiStartTime,
                    salangStartTime = (DateTime?)s.SalangStartTime,
                    packagingStartTime = (DateTime?)s.PackagingStartTime,

                    // LOGISTICS & NOTES
                    location = s.OrderItem!.Order!.DeliveryAddress ?? string.Empty,
                    remarks = s.OrderItem!.Order!.Remarks ?? string.Empty,
                    freebiesSummary = s.OrderItem!.Order!.FreebiesSummary,
                    freebiesConfigJson = s.OrderItem!.Order!.FreebiesConfigJson,
                    addOns = s.OrderItem!.Order!.AddOns ?? "-",

                    // Financials & Fulfillment for Rider View
                    price = s.OrderItem.Order.Price,
                    discount = s.OrderItem.Order.Discount,
                    addOnsTotal = s.OrderItem.Order.OrderItems
                        .Where(item => item.ItemCategory != null && item.ItemCategory.MinimumWeightKg <= 0)
                        .Sum(item => item.TotalPrice),
                    deliveryFee = s.OrderItem.Order.DeliveryFee,
                    downpayment = s.OrderItem.Order.Downpayment,
                    downpaymentMethod = s.OrderItem.Order.DownpaymentMethod,
                    grandTotal = s.OrderItem.Order.GrandTotal,
                    isTrustedCustomer = s.OrderItem.Order.IsTrustedCustomer,
                    isOwnerConfirmed = s.OrderItem.Order.IsOwnerConfirmed,
                    ownerConfirmedAt = s.OrderItem.Order.OwnerConfirmedAt,
                    ownerConfirmedBy = s.OrderItem.Order.OwnerConfirmedBy,
                    fulfillment = (int)s.OrderItem.Order.Fulfillment,
                    quantity = s.OrderItem.Quantity,

                    // Safely map Rider Name
                    riderName = s.OrderItem.Order.DeliveryTrip != null
                        ? s.OrderItem.Order.DeliveryTrip.RiderName
                        : "Unassigned",

                    status = s.CurrentStatus.ToString(),
                    isManualOverride = s.IsManualOverride
                })
                .ToListAsync();

            var result = roastItems.Select(s =>
            {
                var standardWeightRange = (s.minWeight > 0 || s.maxWeight > 0)
                    ? (s.minWeight == s.maxWeight
                        ? $"{s.minWeight:0.##}"
                        : $"{s.minWeight:0.##}-{s.maxWeight:0.##}")
                    : "-";
                var formattedWeight = string.IsNullOrWhiteSpace(s.customWeightDisplay)
                    ? standardWeightRange
                    : s.customWeightDisplay.Trim();

                return new DailySheetItemDto
                {
                    Id = s.id,
                    OrderItemId = s.orderItemId,
                    OrderId = s.orderId,
                    OrderReference = s.orderReference,
                    CustomerName = s.customerName,
                    FacebookName = s.facebookName,
                    ContactNumber = s.contactNumber,
                    Source = s.source,
                    EventType = s.eventType,
                    Landmark = s.landmark,
                    Size = s.size,
                    CategoryName = s.categoryName,
                    BookedSizeName = s.bookedSizeName,
                    BookedItemCategoryId = s.bookedItemCategoryId,
                    FulfilledItemCategoryId = s.fulfilledItemCategoryId,
                    Weight = formattedWeight,
                    WeightRange = formattedWeight,
                    StandardWeightRange = standardWeightRange,
                    CustomWeightDisplay = string.IsNullOrWhiteSpace(s.customWeightDisplay) ? null : s.customWeightDisplay.Trim(),
                    MinWeight = s.minWeight,
                    MaxWeight = s.maxWeight,
                    MinimumWeightKg = s.minWeight,
                    MaximumWeightKg = s.maxWeight,
                    TargetDeliveryTime = s.targetDeliveryTime,
                    RiderDepartureTime = s.riderDepartureTime,
                    TahiStartTime = s.tahiStartTime,
                    SalangStartTime = s.salangStartTime,
                    PackagingStartTime = s.packagingStartTime,
                    Location = s.location,
                    Remarks = s.remarks,
                    FreebiesSummary = s.freebiesSummary,
                    FreebiesConfigJson = s.freebiesConfigJson,
                    AddOns = s.addOns,
                    Price = s.price,
                    LechonPrice = Math.Max(0, s.price - s.discount),
                    AddOnsTotal = s.addOnsTotal,
                    DeliveryFee = s.deliveryFee,
                    Downpayment = s.downpayment,
                    DownpaymentMethod = s.downpaymentMethod,
                    GrandTotal = s.grandTotal,
                    TotalToCollect = Math.Max(
                        0,
                        Math.Max(0, s.price - s.discount) + s.addOnsTotal + s.deliveryFee - s.downpayment),
                    IsTrustedCustomer = s.isTrustedCustomer,
                    IsOwnerConfirmed = s.isOwnerConfirmed,
                    OwnerConfirmedAt = s.ownerConfirmedAt,
                    OwnerConfirmedBy = s.ownerConfirmedBy,
                    Fulfillment = s.fulfillment,
                    Quantity = s.quantity,
                    RiderName = s.riderName,
                    Status = s.status,
                    IsManualOverride = s.isManualOverride,
                    IsTimeTbd = false
                };
            }).ToList();

            // Include confirmed Non-Lechon / Extras-Only orders scheduled on targetDate
            var nonLechonOrders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryTrip)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.FulfilledItemCategory)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.OrderItemSchedule)
                .Where(o => !o.IsDraft
                         && !o.IsCancelled
                         && !o.IsTimeTbd
                         && o.TargetDeliveryTime.HasValue
                         && o.TargetDeliveryTime.Value.Date == targetDate
                         && !o.OrderItems.Any(oi => oi.ItemCategory != null && oi.ItemCategory.MinimumWeightKg > 0))
                .ToListAsync();

            foreach (var order in nonLechonOrders)
            {
                var nonLechonItems = order.OrderItems.Where(oi => oi.ItemCategory == null || oi.ItemCategory.MinimumWeightKg == 0).ToList();
                var addOnsTotal = nonLechonItems.Sum(item => item.TotalPrice);
                if (addOnsTotal <= 0 && order.Price > 0)
                {
                    addOnsTotal = order.Price;
                }

                var totalToCollect = Math.Max(0, addOnsTotal + order.DeliveryFee - order.Downpayment);
                if (nonLechonItems.Count == 0)
                {
                    result.Add(new DailySheetItemDto
                    {
                        Id = order.Id,
                        OrderItemId = order.Id,
                        OrderId = order.Id,
                        OrderReference = order.OrderReference,
                        CustomerName = order.CustomerName,
                        FacebookName = order.FacebookName,
                        ContactNumber = order.ContactNumber,
                        Source = order.Source,
                        EventType = order.EventType,
                        Landmark = order.Landmark,
                        Size = "Extras",
                        CategoryName = "Extras",
                        Weight = "-",
                        WeightRange = "-",
                        MinWeight = 0,
                        MaxWeight = 0,
                        MinimumWeightKg = 0,
                        MaximumWeightKg = 0,
                        TargetDeliveryTime = order.TargetDeliveryTime,
                        RiderDepartureTime = order.RiderDepartureTime ?? order.TargetDeliveryTime,
                        TahiStartTime = null,
                        SalangStartTime = null,
                        PackagingStartTime = null,
                        Priority = null,
                        Location = order.DeliveryAddress ?? string.Empty,
                        Remarks = order.Remarks ?? string.Empty,
                        FreebiesSummary = order.FreebiesSummary,
                        FreebiesConfigJson = order.FreebiesConfigJson,
                        AddOns = order.AddOns ?? "-",
                        Price = order.Price,
                        LechonPrice = 0,
                        AddOnsTotal = addOnsTotal,
                        DeliveryFee = order.DeliveryFee,
                        Downpayment = order.Downpayment,
                        DownpaymentMethod = order.DownpaymentMethod,
                        GrandTotal = order.GrandTotal,
                        TotalToCollect = totalToCollect,
                        IsTrustedCustomer = order.IsTrustedCustomer,
                        IsOwnerConfirmed = order.IsOwnerConfirmed,
                        OwnerConfirmedAt = order.OwnerConfirmedAt,
                        OwnerConfirmedBy = order.OwnerConfirmedBy,
                        Fulfillment = (int)order.Fulfillment,
                        Quantity = 1,
                        RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                        Status = "Confirmed",
                        IsManualOverride = false,
                        IsTimeTbd = false
                    });
                }
                else
                {
                    foreach (var item in nonLechonItems)
                    {
                        var itemName = item.ItemCategory?.Name ?? "Extras";
                        result.Add(new DailySheetItemDto
                        {
                            Id = item.Id,
                            OrderItemId = item.Id,
                            OrderId = order.Id,
                            OrderReference = order.OrderReference,
                            CustomerName = order.CustomerName,
                            FacebookName = order.FacebookName,
                            ContactNumber = order.ContactNumber,
                            Source = order.Source,
                            EventType = order.EventType,
                            Landmark = order.Landmark,
                            Size = itemName,
                            CategoryName = itemName,
                            Weight = "-",
                            WeightRange = "-",
                            MinWeight = 0,
                            MaxWeight = 0,
                            MinimumWeightKg = 0,
                            MaximumWeightKg = 0,
                            TargetDeliveryTime = order.TargetDeliveryTime,
                            RiderDepartureTime = order.RiderDepartureTime ?? order.TargetDeliveryTime,
                            TahiStartTime = null,
                            SalangStartTime = null,
                            PackagingStartTime = null,
                            Priority = null,
                            Location = order.DeliveryAddress ?? string.Empty,
                            Remarks = order.Remarks ?? string.Empty,
                            FreebiesSummary = order.FreebiesSummary,
                            FreebiesConfigJson = order.FreebiesConfigJson,
                            AddOns = order.AddOns ?? "-",
                            Price = order.Price,
                            LechonPrice = 0,
                            AddOnsTotal = addOnsTotal,
                            DeliveryFee = order.DeliveryFee,
                            Downpayment = order.Downpayment,
                            DownpaymentMethod = order.DownpaymentMethod,
                            GrandTotal = order.GrandTotal,
                            TotalToCollect = totalToCollect,
                            IsTrustedCustomer = order.IsTrustedCustomer,
                            IsOwnerConfirmed = order.IsOwnerConfirmed,
                            OwnerConfirmedAt = order.OwnerConfirmedAt,
                            OwnerConfirmedBy = order.OwnerConfirmedBy,
                            Fulfillment = (int)order.Fulfillment,
                            Quantity = item.Quantity,
                            RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                            Status = "Confirmed",
                            IsManualOverride = false,
                            IsTimeTbd = false
                        });
                    }
                }
            }

            // Include Time-TBD orders scheduled on targetDate
            var timeTbdOrders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryTrip)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.FulfilledItemCategory)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.OrderItemSchedule)
                .Where(o => !o.IsDraft
                         && !o.IsCancelled
                         && o.IsTimeTbd
                         && o.TargetDeliveryTime.HasValue
                         && o.TargetDeliveryTime.Value.Date == targetDate)
                .ToListAsync();

            foreach (var order in timeTbdOrders)
            {
                var roastItemsList = order.OrderItems
                    .Where(oi => oi.ItemCategory != null && oi.ItemCategory.MinimumWeightKg > 0)
                    .ToList();

                var addOnsTotal = order.OrderItems
                    .Where(item => item.ItemCategory != null && item.ItemCategory.MinimumWeightKg <= 0)
                    .Sum(item => item.TotalPrice);

                var lechonPrice = Math.Max(0, order.Price - order.Discount);
                var totalToCollect = Math.Max(0, lechonPrice + addOnsTotal + order.DeliveryFee - order.Downpayment);

                if (roastItemsList.Count == 0)
                {
                    result.Add(new DailySheetItemDto
                    {
                        Id = order.Id,
                        OrderItemId = order.Id,
                        OrderId = order.Id,
                        OrderReference = order.OrderReference,
                        CustomerName = order.CustomerName,
                        FacebookName = order.FacebookName,
                        ContactNumber = order.ContactNumber,
                        Source = order.Source,
                        EventType = order.EventType,
                        Landmark = order.Landmark,
                        Size = "Order TBD",
                        CategoryName = "Order TBD",
                        Weight = "-",
                        WeightRange = "-",
                        MinWeight = 0,
                        MaxWeight = 0,
                        MinimumWeightKg = 0,
                        MaximumWeightKg = 0,
                        TargetDeliveryTime = order.TargetDeliveryTime,
                        RiderDepartureTime = null,
                        TahiStartTime = null,
                        SalangStartTime = null,
                        PackagingStartTime = null,
                        Priority = null,
                        Location = order.DeliveryAddress ?? string.Empty,
                        Remarks = order.Remarks ?? string.Empty,
                        FreebiesSummary = order.FreebiesSummary,
                        FreebiesConfigJson = order.FreebiesConfigJson,
                        AddOns = order.AddOns ?? "-",
                        Price = order.Price,
                        LechonPrice = lechonPrice,
                        AddOnsTotal = addOnsTotal,
                        DeliveryFee = order.DeliveryFee,
                        Downpayment = order.Downpayment,
                        DownpaymentMethod = order.DownpaymentMethod,
                        GrandTotal = order.GrandTotal,
                        TotalToCollect = totalToCollect,
                        IsTrustedCustomer = order.IsTrustedCustomer,
                        IsOwnerConfirmed = order.IsOwnerConfirmed,
                        OwnerConfirmedAt = order.OwnerConfirmedAt,
                        OwnerConfirmedBy = order.OwnerConfirmedBy,
                        Fulfillment = (int)order.Fulfillment,
                        Quantity = 1,
                        RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                        Status = "Time TBD",
                        IsManualOverride = false,
                        IsTimeTbd = true
                    });
                }
                else
                {
                    foreach (var item in roastItemsList)
                    {
                        var cookingCategory = item.FulfilledItemCategory ?? item.ItemCategory;
                        var minW = cookingCategory?.MinimumWeightKg ?? 0m;
                        var maxW = cookingCategory?.MaximumWeightKg ?? 0m;
                        var formattedWeight = (minW > 0 || maxW > 0)
                            ? (minW == maxW ? minW.ToString("0.##") : $"{minW:0.##}-{maxW:0.##}")
                            : "-";
                        var customWeightDisplay = item.OrderItemSchedule?.CustomWeightDisplay;
                        var displayWeight = string.IsNullOrWhiteSpace(customWeightDisplay)
                            ? formattedWeight
                            : customWeightDisplay.Trim();

                        result.Add(new DailySheetItemDto
                        {
                            Id = item.Id,
                            OrderItemId = item.Id,
                            OrderId = order.Id,
                            OrderReference = order.OrderReference,
                            CustomerName = order.CustomerName,
                            FacebookName = order.FacebookName,
                            ContactNumber = order.ContactNumber,
                            Source = order.Source,
                            EventType = order.EventType,
                            Landmark = order.Landmark,
                            Size = cookingCategory?.Name ?? "Lechon",
                            CategoryName = cookingCategory?.Name ?? "Lechon",
                            BookedSizeName = item.FulfilledItemCategoryId.HasValue && item.FulfilledItemCategoryId != item.ItemCategoryId
                                ? item.ItemCategory?.Name
                                : null,
                            BookedItemCategoryId = item.ItemCategoryId,
                            FulfilledItemCategoryId = item.FulfilledItemCategoryId,
                            Weight = displayWeight,
                            WeightRange = displayWeight,
                            StandardWeightRange = formattedWeight,
                            CustomWeightDisplay = string.IsNullOrWhiteSpace(customWeightDisplay) ? null : customWeightDisplay.Trim(),
                            MinWeight = minW,
                            MaxWeight = maxW,
                            MinimumWeightKg = minW,
                            MaximumWeightKg = maxW,
                            TargetDeliveryTime = order.TargetDeliveryTime,
                            RiderDepartureTime = null,
                            TahiStartTime = null,
                            SalangStartTime = null,
                            PackagingStartTime = null,
                            Priority = null,
                            Location = order.DeliveryAddress ?? string.Empty,
                            Remarks = order.Remarks ?? string.Empty,
                            FreebiesSummary = order.FreebiesSummary,
                            FreebiesConfigJson = order.FreebiesConfigJson,
                            AddOns = order.AddOns ?? "-",
                            Price = order.Price,
                            LechonPrice = lechonPrice,
                            AddOnsTotal = addOnsTotal,
                            DeliveryFee = order.DeliveryFee,
                            Downpayment = order.Downpayment,
                            DownpaymentMethod = order.DownpaymentMethod,
                            GrandTotal = order.GrandTotal,
                            TotalToCollect = totalToCollect,
                            IsTrustedCustomer = order.IsTrustedCustomer,
                            IsOwnerConfirmed = order.IsOwnerConfirmed,
                            OwnerConfirmedAt = order.OwnerConfirmedAt,
                            OwnerConfirmedBy = order.OwnerConfirmedBy,
                            Fulfillment = (int)order.Fulfillment,
                            Quantity = item.Quantity,
                            RiderName = order.DeliveryTrip?.RiderName ?? "Unassigned",
                            Status = "Time TBD",
                            IsManualOverride = false,
                            IsTimeTbd = true
                        });
                    }
                }
            }

            return new DailySheetsResponseDto
            {
                TargetDate = targetDate.ToString("yyyy-MM-dd"),
                FormattedDate = targetDate.ToString("dddd, MMMM dd, yyyy"),
                Items = result
            };
        }

        private static DateTime NormalizeToLocalStoreTime(DateTime dt)
            => DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);

        private static DateTime AnchorClockToTargetDate(
            DateTime value,
            DateTime targetDeliveryTime,
            DateTime? departureTime = null)
        {
            var target = NormalizeToLocalStoreTime(targetDeliveryTime);
            var anchored = NormalizeToLocalStoreTime(target.Date.Add(value.TimeOfDay));
            if (departureTime.HasValue &&
                departureTime.Value.Hour >= 1 && departureTime.Value.Hour <= 5 &&
                anchored > departureTime.Value)
            {
                anchored = anchored.AddDays(-1);
            }

            return anchored;
        }

        public Task<OrderItemSchedule> OverrideScheduleAsync(int orderItemId, OverrideScheduleRequest request)
            => OverrideScheduleItemAsync(orderItemId, request);

        public async Task<OrderItemSchedule> OverrideScheduleItemAsync(int orderItemId, OverrideScheduleRequest request)
        {
            var schedule = await _context.OrderItemSchedules
                .Include(s => s.OrderItem)
                    .ThenInclude(oi => oi!.Order)
                        .ThenInclude(o => o!.DeliveryTrip)
                .FirstOrDefaultAsync(s => s.OrderItemId == orderItemId)
                ?? await _context.OrderItemSchedules
                    .Include(s => s.OrderItem)
                        .ThenInclude(oi => oi!.Order)
                            .ThenInclude(o => o!.DeliveryTrip)
                    .FirstOrDefaultAsync(s => s.Id == orderItemId);

            if (schedule == null)
            {
                var item = await _context.OrderItems
                    .Include(orderItem => orderItem.Order)
                    .FirstOrDefaultAsync(orderItem => orderItem.Id == orderItemId);
                if (item?.Order?.TargetDeliveryTime != null)
                {
                    var cookingCategoryId = item.FulfilledItemCategoryId ?? item.ItemCategoryId;
                    schedule = await CalculateScheduleAsync(
                        item.Id,
                        item.Order.TargetDeliveryTime.Value,
                        cookingCategoryId,
                        item.Order.RiderDepartureTime);
                    schedule.OrderItem = item;
                    _context.OrderItemSchedules.Add(schedule);
                }
            }

            if (schedule == null)
                throw new KeyNotFoundException($"Schedule for OrderItem #{orderItemId} not found.");

            var scheduleOrder = schedule.OrderItem?.Order
                ?? throw new InvalidOperationException("Schedule is not linked to an order.");
            var targetDeliveryTime = NormalizeToLocalStoreTime(
                scheduleOrder.TargetDeliveryTime ?? schedule.TargetDeliveryTime);
            var requestedDeparture = request.DepartureTime ?? request.RiderDepartureTime;
            var normalizedRequestedDeparture = requestedDeparture.HasValue
                ? AnchorClockToTargetDate(requestedDeparture.Value, targetDeliveryTime)
                : (DateTime?)null;
            var effectiveDepartureForAnchoring = normalizedRequestedDeparture
                ?? (scheduleOrder.RiderDepartureTime.HasValue
                    ? AnchorClockToTargetDate(scheduleOrder.RiderDepartureTime.Value, targetDeliveryTime)
                    : targetDeliveryTime);

            if (request.CustomWeightDisplay != null)
            {
                schedule.CustomWeightDisplay = string.IsNullOrWhiteSpace(request.CustomWeightDisplay)
                    ? null
                    : request.CustomWeightDisplay.Trim();
            }

            if (request.FulfilledItemCategoryId.HasValue && schedule.OrderItem != null)
            {
                var targetFulfilledCatId = request.FulfilledItemCategoryId.Value > 0 
                    ? (int?)request.FulfilledItemCategoryId.Value 
                    : null;
                var oldFulfilledCatId = schedule.OrderItem.FulfilledItemCategoryId;

                if (oldFulfilledCatId != targetFulfilledCatId)
                {
                    var fromCatId = oldFulfilledCatId ?? schedule.OrderItem.ItemCategoryId;
                    var toCatId = targetFulfilledCatId ?? schedule.OrderItem.ItemCategoryId;

                    var fromCat = await _context.ItemCategories.FindAsync(fromCatId);
                    var toCat = await _context.ItemCategories.FindAsync(toCatId);

                    var fromName = fromCat?.Name ?? $"Cat #{fromCatId}";
                    var toName = toCat?.Name ?? $"Cat #{toCatId}";

                    // If item has Quantity > 1 and is being upgraded, split 1 unit off into a sibling OrderItem!
                    if (schedule.OrderItem.Quantity > 1 && targetFulfilledCatId.HasValue)
                    {
                        schedule.OrderItem.Quantity -= 1;
                        schedule.OrderItem.TotalPrice = schedule.OrderItem.Price * schedule.OrderItem.Quantity;

                        var splitItem = new OrderItem
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ItemCategoryId = schedule.OrderItem.ItemCategoryId,
                            FulfilledItemCategoryId = targetFulfilledCatId,
                            Quantity = 1,
                            Price = schedule.OrderItem.Price,
                            TotalPrice = schedule.OrderItem.Price,
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.OrderItems.Add(splitItem);
                        await _context.SaveChangesAsync();

                        var anchorTime = normalizedRequestedDeparture
                            ?? schedule.OrderItem.Order?.RiderDepartureTime
                            ?? targetDeliveryTime;

                        var splitSchedule = await CalculateScheduleAsync(
                            splitItem.Id,
                            schedule.OrderItem.Order?.TargetDeliveryTime ?? schedule.TargetDeliveryTime,
                            toCatId,
                            anchorTime);

                        splitSchedule.CustomWeightDisplay = schedule.CustomWeightDisplay;
                        splitSchedule.IsManualOverride = true;
                        splitSchedule.OrderItem = splitItem;
                        _context.OrderItemSchedules.Add(splitSchedule);

                        _context.InventoryReservations.Add(new InventoryReservation
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ItemCategoryId = toCatId,
                            ReservationDate = schedule.OrderItem.Order?.TargetDeliveryTime?.Date ?? DateTime.UtcNow.Date,
                            Status = ReservationStatus.Committed,
                            ReservationStatus = ReservationStatus.Committed,
                            CreatedAt = DateTime.UtcNow
                        });

                        _context.OrderAuditLogs.Add(new OrderAuditLog
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ActionType = "Stock Substitution Updated",
                            Changes = $"Freezer stock partial upgrade: 1x '{fromName}' of {schedule.OrderItem.Quantity + 1}x order split and fulfilled using '{toName}' stock (Complimentary upgrade).",
                            ChangedBy = CurrentUser,
                            Timestamp = DateTime.UtcNow
                        });

                        await _context.SaveChangesAsync();
                        return splitSchedule;
                    }
                    else
                    {
                        schedule.OrderItem.FulfilledItemCategoryId = targetFulfilledCatId;

                        // Update committed inventory reservation to point to the effective category
                        var reservation = await _context.InventoryReservations
                            .FirstOrDefaultAsync(r => r.OrderId == schedule.OrderItem.OrderId && r.ItemCategoryId == fromCatId);
                        if (reservation != null)
                        {
                            reservation.ItemCategoryId = toCatId;
                        }

                        _context.OrderAuditLogs.Add(new OrderAuditLog
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ActionType = "Stock Substitution Updated",
                            Changes = targetFulfilledCatId.HasValue
                                ? $"Freezer stock fulfillment changed from '{fromName}' to '{toName}' (Complimentary upgrade)."
                                : $"Freezer stock fulfillment reverted to booked size '{toName}'.",
                            ChangedBy = CurrentUser,
                            Timestamp = DateTime.UtcNow
                        });

                        // Dynamic schedule recalculation (Auto-Shift Tahi & Salang Earlier) on size upgrade / substitution
                        // If caller did not provide explicit manual tahi / salang times, auto-shift using new cooking profile!
                        if (!request.TahiStartTime.HasValue && !request.SalangStartTime.HasValue)
                        {
                            var profile = await _context.ProductCookingProfiles
                                .FirstOrDefaultAsync(p => p.ItemCategoryId == toCatId);
                            int tahiDuration = profile?.TahiDurationMinutes ?? 60;
                            int salangDuration = profile?.SalangDurationMinutes ?? 180;
                            int packagingDuration = profile?.PackagingDurationMinutes ?? 30;

                            var anchorTime = normalizedRequestedDeparture
                                ?? schedule.OrderItem.Order?.RiderDepartureTime
                                ?? targetDeliveryTime;

                            var normalizedAnchor = AnchorClockToTargetDate(anchorTime, targetDeliveryTime);
                            schedule.PackagingStartTime = normalizedAnchor.AddMinutes(-packagingDuration);
                            schedule.SalangStartTime = schedule.PackagingStartTime.AddMinutes(-salangDuration);
                            schedule.TahiStartTime = schedule.SalangStartTime.AddMinutes(-tahiDuration);
                        }
                    }
                }
            }

            if (request.TahiStartTime.HasValue)
                schedule.TahiStartTime = AnchorClockToTargetDate(
                    request.TahiStartTime.Value,
                    targetDeliveryTime,
                    effectiveDepartureForAnchoring);

            if (request.SalangStartTime.HasValue)
                schedule.SalangStartTime = AnchorClockToTargetDate(
                    request.SalangStartTime.Value,
                    targetDeliveryTime,
                    effectiveDepartureForAnchoring);

            if (request.PackagingStartTime.HasValue)
                schedule.PackagingStartTime = AnchorClockToTargetDate(
                    request.PackagingStartTime.Value,
                    targetDeliveryTime,
                    effectiveDepartureForAnchoring);

            if (normalizedRequestedDeparture.HasValue)
            {
                scheduleOrder.RiderDepartureTime = normalizedRequestedDeparture.Value;
            }

            schedule.IsManualOverride = true;

            if (!string.IsNullOrWhiteSpace(request.Remarks) && schedule.OrderItem?.Order != null)
                schedule.OrderItem.Order.Remarks = request.Remarks;

            if (request.RiderName != null && schedule.OrderItem?.Order != null)
            {
                var cleanRider = request.RiderName.Trim();
                var oldRider = schedule.OrderItem.Order.DeliveryTrip?.RiderName?.Trim() ?? "";

                if (string.IsNullOrWhiteSpace(cleanRider) || cleanRider.Equals("Unassigned", StringComparison.OrdinalIgnoreCase))
                {
                    // Detach / Unassign rider
                    var oldTripId = schedule.OrderItem.Order.DeliveryTripId;
                    schedule.OrderItem.Order.DeliveryTripId = null;
                    schedule.OrderItem.Order.RoutingStatus = DeliveryStatus.Unassigned;

                    if (oldTripId.HasValue)
                    {
                        var hasOtherOrders = await _context.Orders.AnyAsync(o => o.DeliveryTripId == oldTripId.Value && o.Id != schedule.OrderItem.OrderId);
                        if (!hasOtherOrders)
                        {
                            var trip = await _context.DeliveryTrips.FindAsync(oldTripId.Value);
                            if (trip != null)
                            {
                                _context.DeliveryTrips.Remove(trip);
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(oldRider))
                    {
                        _context.OrderAuditLogs.Add(new OrderAuditLog
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ActionType = "Rider Updated",
                            Changes = $"Rider unassigned (previously '{oldRider}')",
                            ChangedBy = CurrentUser,
                            Timestamp = DateTime.UtcNow
                        });
                    }
                }
                else
                {
                    if (schedule.OrderItem.Order.Fulfillment != FulfillmentType.Delivery)
                    {
                        throw new InvalidOperationException("Only Delivery orders can be assigned to freelance riders.");
                    }

                    await RiderRegistrationHelper.EnsureRiderRegisteredAsync(_context, cleanRider);

                    // Update assigned rider on active DeliveryTrip if present
                    var trip = schedule.OrderItem.Order.DeliveryTrip
                        ?? await _context.DeliveryTrips.Include(t => t.Orders)
                            .FirstOrDefaultAsync(t => t.Orders.Any(o => o.Id == schedule.OrderItem.OrderId));

                    if (trip != null)
                    {
                        trip.RiderName = cleanRider;
                    }
                    else
                    {
                        trip = new DeliveryTrip
                        {
                            RiderName = cleanRider,
                            VehicleType = "Motorcycle",
                            Status = DeliveryStatus.Assigned,
                            DispatchTime = DateTime.UtcNow
                        };
                        trip.Orders.Add(schedule.OrderItem.Order);
                        schedule.OrderItem.Order.RoutingStatus = DeliveryStatus.Assigned;
                        _context.DeliveryTrips.Add(trip);
                    }

                    await RiderRegistrationHelper.EnsureRiderRegisteredAsync(_context, cleanRider);

                    if (!string.Equals(oldRider, cleanRider, StringComparison.OrdinalIgnoreCase))
                    {
                        string auditMsg = string.IsNullOrEmpty(oldRider)
                            ? $"Rider assigned: '{cleanRider}'"
                            : $"Rider changed from '{oldRider}' to '{cleanRider}'";

                        _context.OrderAuditLogs.Add(new OrderAuditLog
                        {
                            OrderId = schedule.OrderItem.OrderId,
                            ActionType = "Rider Updated",
                            Changes = auditMsg,
                            ChangedBy = CurrentUser,
                            Timestamp = DateTime.UtcNow
                        });
                    }
                }
            }

            await _context.SaveChangesAsync();
            return schedule;
        }

        public Task<FreebiesPrepResponseDto> GetFreebiesPrepAsync(DateTime? date = null)
        {
            var targetDate = (date ?? PhilippineTime.Today).Date;
            targetDate = PhilippineTime.NormalizeYear(targetDate);
            return GetFreebiesPrepSheetAsync(targetDate);
        }

        public async Task<FreebiesPrepResponseDto> GetFreebiesPrepSheetAsync(DateTime targetDate)
        {
            targetDate = PhilippineTime.NormalizeYear(targetDate).Date;

            // 1. Fetch active customer orders for targetDate (non-cancelled, non-draft, with target time on date)
            var activeOrders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryTrip)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.ItemCategory)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.FulfilledItemCategory)
                .Where(o => !o.IsCancelled
                         && !o.IsDraft
                         && o.TargetDeliveryTime.HasValue
                         && o.TargetDeliveryTime.Value.Date == targetDate)
                .ToListAsync();

            // 2. Fetch KitchenPrepRequests for targetDate
            var prepRequests = await _context.KitchenPrepRequests
                .AsNoTracking()
                .Where(p => p.TargetDate.Date == targetDate)
                .OrderBy(p => p.TargetTime)
                .ToListAsync();

            var summary = new FreebiesPrepSummaryDto();
            var roster = new List<FreebiePrepRosterRowDto>();
            var prepRequestDtos = new List<KitchenPrepRequestDto>();

            // 3. Process each customer order
            foreach (var order in activeOrders)
            {
                var row = ProcessOrderFreebies(order, summary);
                roster.Add(row);
            }

            // 4. Process each KitchenPrepRequest (Store Paluto)
            foreach (var prep in prepRequests)
            {
                var itemsDict = DeserializePrepItems(prep.ItemsJson);
                prepRequestDtos.Add(new KitchenPrepRequestDto
                {
                    Id = prep.Id,
                    TargetDate = prep.TargetDate,
                    TargetTime = prep.TargetTime,
                    TargetTimeDisplay = prep.TargetTime.ToString("hh:mm tt"),
                    Category = prep.Category,
                    RecipientOrLabel = prep.RecipientOrLabel,
                    ItemsJson = prep.ItemsJson,
                    Items = itemsDict,
                    Remarks = prep.Remarks,
                    CreatedBy = prep.CreatedBy,
                    CreatedAt = prep.CreatedAt
                });

                var pills = new List<PackItemPillDto>();
                foreach (var (itemName, qty) in itemsDict)
                {
                    if (qty <= 0) continue;
                    var normalized = NormalizeSideItemName(itemName);
                    switch (normalized)
                    {
                        case "Sarsa":
                            summary.Sarsa.Paluto += qty;
                            break;
                        case "Pancit":
                            summary.Pancit.Paluto += qty;
                            break;
                        case "Palabok":
                            summary.Palabok.Paluto += qty;
                            break;
                        case "Spaghetti":
                            summary.Spaghetti.Paluto += qty;
                            break;
                        case "Dinuguan":
                            summary.Dinuguan.Paluto += qty;
                            break;
                        case "Puto":
                            summary.Puto.Paluto += qty;
                            break;
                        case "1.5L Coke":
                            summary.Coke15L.Paluto += qty;
                            break;
                        case "Raw Innards":
                            summary.RawInnardsHilaw.Paluto += qty;
                            break;
                    }

                    pills.Add(new PackItemPillDto
                    {
                        ItemName = normalized,
                        Quantity = qty,
                        BadgeType = "Paluto",
                        Label = $"{qty}x {normalized} (Paluto)"
                    });
                }

                string categoryBadge = prep.Category switch
                {
                    "Staff Meryenda" => "👥 Staff Meryenda",
                    "Owner / Family" => "👑 Owner / Family",
                    "VIP Gift" => "🎁 VIP Gift",
                    "Store Buffer" => "🏪 Store Buffer",
                    _ => prep.Category.Contains("Staff", StringComparison.OrdinalIgnoreCase) ? "👥 Staff Meryenda" :
                         prep.Category.Contains("Owner", StringComparison.OrdinalIgnoreCase) || prep.Category.Contains("Family", StringComparison.OrdinalIgnoreCase) ? "👑 Owner / Family" :
                         prep.Category.Contains("VIP", StringComparison.OrdinalIgnoreCase) ? "🎁 VIP Gift" :
                         prep.Category.Contains("Buffer", StringComparison.OrdinalIgnoreCase) ? "🏪 Store Buffer" :
                         $"🏠 {prep.Category}"
                };

                roster.Add(new FreebiePrepRosterRowDto
                {
                    Id = $"prep-{prep.Id}",
                    RowType = "Paluto",
                    PrepRequestId = prep.Id,
                    IsPrepRequest = true,
                    OrderRef = $"PALUTO-{prep.Id}",
                    OrderReference = $"PALUTO-{prep.Id}",
                    Recipient = prep.RecipientOrLabel,
                    TypeItem = categoryBadge,
                    Category = prep.Category,
                    FulfillmentType = "Internal",
                    RouteDisplay = "🏠 Internal Kitchen",
                    TimeNeeded = prep.TargetTime,
                    TimeNeededDisplay = prep.TargetTime.ToString("hh:mm tt"),
                    IsTimeTbd = false,
                    IsNoFreebies = false,
                    IsRawInnards = false,
                    FreebiesSummary = null,
                    ChecklistPills = pills,
                    Remarks = prep.Remarks ?? string.Empty,
                    CreatedBy = prep.CreatedBy
                });
            }

            // 5. Chronological Sort:
            // Scheduled items sort ascending by TimeNeeded (earliest first). Time TBD orders sort at the bottom.
            var sortedRoster = roster
                .OrderBy(r => r.IsTimeTbd ? 1 : 0)
                .ThenBy(r => r.TimeNeeded ?? DateTime.MaxValue)
                .ThenBy(r => r.IsPrepRequest ? 1 : 0)
                .ThenBy(r => r.OrderRef)
                .ToList();

            return new FreebiesPrepResponseDto
            {
                TargetDate = targetDate.ToString("yyyy-MM-dd"),
                FormattedDate = targetDate.ToString("dddd, MMMM dd, yyyy"),
                Summary = summary,
                Roster = sortedRoster,
                PrepRequests = prepRequestDtos
            };
        }

        public async Task<KitchenPrepRequestDto> CreateKitchenPrepRequestAsync(CreateKitchenPrepRequestDto request, string createdBy)
        {
            var targetDate = NormalizeToLocalStoreTime(request.TargetDate).Date;
            targetDate = PhilippineTime.NormalizeYear(targetDate);
            var targetTime = NormalizeToLocalStoreTime(request.TargetTime);

            string itemsJson;
            Dictionary<string, int> itemsDict;
            if (request.Items != null && request.Items.Count > 0)
            {
                itemsDict = request.Items;
                itemsJson = JsonSerializer.Serialize(request.Items);
            }
            else if (!string.IsNullOrWhiteSpace(request.ItemsJson))
            {
                itemsJson = request.ItemsJson;
                itemsDict = DeserializePrepItems(itemsJson);
            }
            else
            {
                itemsJson = "{}";
                itemsDict = new Dictionary<string, int>();
            }

            var author = !string.IsNullOrWhiteSpace(createdBy)
                ? createdBy
                : CurrentUser;

            var prep = new KitchenPrepRequest
            {
                TargetDate = targetDate,
                TargetTime = targetTime,
                Category = request.Category.Trim(),
                RecipientOrLabel = request.RecipientOrLabel.Trim(),
                ItemsJson = itemsJson,
                Remarks = request.Remarks?.Trim(),
                CreatedBy = author,
                CreatedAt = DateTime.UtcNow
            };

            _context.KitchenPrepRequests.Add(prep);
            await _context.SaveChangesAsync();

            return new KitchenPrepRequestDto
            {
                Id = prep.Id,
                TargetDate = prep.TargetDate,
                TargetTime = prep.TargetTime,
                TargetTimeDisplay = prep.TargetTime.ToString("hh:mm tt"),
                Category = prep.Category,
                RecipientOrLabel = prep.RecipientOrLabel,
                ItemsJson = prep.ItemsJson,
                Items = itemsDict,
                Remarks = prep.Remarks,
                CreatedBy = prep.CreatedBy,
                CreatedAt = prep.CreatedAt
            };
        }

        public async Task<bool> DeleteKitchenPrepRequestAsync(int id)
        {
            var prep = await _context.KitchenPrepRequests.FindAsync(id);
            if (prep == null) return false;

            _context.KitchenPrepRequests.Remove(prep);
            await _context.SaveChangesAsync();
            return true;
        }

        private FreebiePrepRosterRowDto ProcessOrderFreebies(Order order, FreebiesPrepSummaryDto summary)
        {
            var wholePigItems = order.OrderItems
                .Where(oi => oi.ItemCategory != null && oi.ItemCategory.MinimumWeightKg >= 13)
                .ToList();
            int wholePigCount = wholePigItems.Sum(oi => oi.Quantity);

            var bellyItems = order.OrderItems
                .Where(oi => oi.ItemCategory != null && oi.ItemCategory.MinimumWeightKg >= 2 && oi.ItemCategory.MinimumWeightKg <= 5)
                .ToList();

            var paidAddOnItems = order.OrderItems
                .Where(oi => oi.ItemCategory != null && oi.ItemCategory.MinimumWeightKg <= 0)
                .ToList();

            // Determine Freebie State
            var (isNoFreebies, isRawInnards, hasBellyCokeSwap, counts, bellyCounts) = ResolveFreebiesState(order, wholePigCount, bellyItems);

            var pills = new List<PackItemPillDto>();

            // 1. Process Whole Lechon Freebies
            if (wholePigCount > 0)
            {
                if (isNoFreebies)
                {
                    // Guarantees 1x Sarsa per whole pig even when opted out of the 7 freebies (Less ₱2k)
                    summary.Sarsa.NoFreebiesSarsaGuaranteed += wholePigCount;
                    pills.Add(new PackItemPillDto
                    {
                        ItemName = "Sarsa",
                        Quantity = wholePigCount,
                        BadgeType = "NoFreebies",
                        Label = $"🚫 NO FREEBIES (Less ₱2k) • {wholePigCount}x Sarsa Only"
                    });
                }
                else
                {
                    int sarsaQty = counts.GetValueOrDefault("Sarsa", wholePigCount);
                    int cokeQty = counts.GetValueOrDefault("1.5L Coke", wholePigCount);
                    int pancitQty = counts.GetValueOrDefault("Pancit", wholePigCount);
                    int palabokQty = counts.GetValueOrDefault("Palabok", wholePigCount);
                    int spagQty = counts.GetValueOrDefault("Spaghetti", wholePigCount);
                    int putoQty = counts.GetValueOrDefault("Puto", wholePigCount);

                    summary.Sarsa.WholeFreebies += sarsaQty;
                    summary.Coke15L.Freebies += cokeQty;
                    summary.Pancit.Freebies += pancitQty;
                    summary.Palabok.Freebies += palabokQty;
                    summary.Spaghetti.Freebies += spagQty;
                    summary.Puto.Freebies += putoQty;

                    if (isRawInnards)
                    {
                        summary.RawInnardsHilaw.Bags += wholePigCount;
                        summary.Dinuguan.ExcludedRawInnardsOrders += wholePigCount;
                        pills.Add(new PackItemPillDto
                        {
                            ItemName = "Raw Innards",
                            Quantity = wholePigCount,
                            BadgeType = "Special",
                            Label = $"🥩 {wholePigCount}x Raw Innards (Hilaw - Do NOT Cook Dinuguan)"
                        });
                    }
                    else
                    {
                        int dinuguanQty = counts.GetValueOrDefault("Dinuguan", wholePigCount);
                        summary.Dinuguan.Freebies += dinuguanQty;
                        if (dinuguanQty > 0)
                        {
                            pills.Add(new PackItemPillDto
                            {
                                ItemName = "Dinuguan",
                                Quantity = dinuguanQty,
                                BadgeType = "Freebie",
                                Label = $"{dinuguanQty}x Dinuguan"
                            });
                        }
                    }

                    if (sarsaQty > 0) pills.Add(new PackItemPillDto { ItemName = "Sarsa", Quantity = sarsaQty, BadgeType = "Freebie", Label = $"{sarsaQty}x Sarsa" });
                    if (pancitQty > 0) pills.Add(new PackItemPillDto { ItemName = "Pancit", Quantity = pancitQty, BadgeType = "Freebie", Label = $"{pancitQty}x Pancit" });
                    if (palabokQty > 0) pills.Add(new PackItemPillDto { ItemName = "Palabok", Quantity = palabokQty, BadgeType = "Freebie", Label = $"{palabokQty}x Palabok" });
                    if (spagQty > 0) pills.Add(new PackItemPillDto { ItemName = "Spaghetti", Quantity = spagQty, BadgeType = "Freebie", Label = $"{spagQty}x Spaghetti" });
                    if (putoQty > 0) pills.Add(new PackItemPillDto { ItemName = "Puto", Quantity = putoQty, BadgeType = "Freebie", Label = $"{putoQty}x Puto" });
                    if (cokeQty > 0) pills.Add(new PackItemPillDto { ItemName = "1.5L Coke", Quantity = cokeQty, BadgeType = "Freebie", Label = $"{cokeQty}x 1.5L Coke" });
                }
            }

            // 2. Process Belly Freebies
            foreach (var (item, qty) in bellyCounts)
            {
                if (qty <= 0) continue;
                var normalized = NormalizeSideItemName(item);
                if (normalized == "Sarsa")
                {
                    summary.Sarsa.BellyFreebies += qty;
                    if (!isNoFreebies || wholePigCount == 0)
                    {
                        pills.Add(new PackItemPillDto { ItemName = "Sarsa", Quantity = qty, BadgeType = "Freebie", Label = $"{qty}x Sarsa" });
                    }
                }
                else if (normalized == "1.5L Coke")
                {
                    // 4x Coke per 5kg belly bilao swap
                    summary.Coke15L.BellySwaps += qty;
                    pills.Add(new PackItemPillDto
                    {
                        ItemName = "1.5L Coke",
                        Quantity = qty,
                        BadgeType = "Special",
                        Label = $"{qty}x 1.5L Coke (Bilao Swapped)"
                    });
                }
                else if (normalized == "Pancit")
                {
                    summary.Pancit.Freebies += qty;
                    pills.Add(new PackItemPillDto { ItemName = "Pancit", Quantity = qty, BadgeType = "Freebie", Label = $"{qty}x Pancit" });
                }
                else if (normalized == "Palabok")
                {
                    summary.Palabok.Freebies += qty;
                    pills.Add(new PackItemPillDto { ItemName = "Palabok", Quantity = qty, BadgeType = "Freebie", Label = $"{qty}x Palabok" });
                }
                else if (normalized == "Spaghetti")
                {
                    summary.Spaghetti.Freebies += qty;
                    pills.Add(new PackItemPillDto { ItemName = "Spaghetti", Quantity = qty, BadgeType = "Freebie", Label = $"{qty}x Spaghetti" });
                }
                else if (normalized == "Dinuguan")
                {
                    summary.Dinuguan.Freebies += qty;
                    pills.Add(new PackItemPillDto { ItemName = "Dinuguan", Quantity = qty, BadgeType = "Freebie", Label = $"{qty}x Dinuguan" });
                }
                else if (normalized == "Puto")
                {
                    summary.Puto.Freebies += qty;
                    pills.Add(new PackItemPillDto { ItemName = "Puto", Quantity = qty, BadgeType = "Freebie", Label = $"{qty}x Puto" });
                }
            }

            // 3. Process Customer Paid Side-Dish Add-Ons
            var addOnItemsDict = ExtractPaidAddOns(order, paidAddOnItems);
            foreach (var (item, qty) in addOnItemsDict)
            {
                if (qty <= 0) continue;
                var normalized = NormalizeSideItemName(item);
                switch (normalized)
                {
                    case "Sarsa":
                        summary.Sarsa.PaidAddOns += qty;
                        break;
                    case "Pancit":
                        summary.Pancit.PaidAddOns += qty;
                        break;
                    case "Palabok":
                        summary.Palabok.PaidAddOns += qty;
                        break;
                    case "Spaghetti":
                        summary.Spaghetti.PaidAddOns += qty;
                        break;
                    case "Dinuguan":
                        summary.Dinuguan.PaidAddOns += qty;
                        break;
                    case "Puto":
                        summary.Puto.PaidAddOns += qty;
                        break;
                    case "1.5L Coke":
                        summary.Coke15L.PaidAddOns += qty;
                        break;
                    case "Raw Innards":
                        summary.RawInnardsHilaw.PaidAddOns += qty;
                        break;
                }

                pills.Add(new PackItemPillDto
                {
                    ItemName = normalized,
                    Quantity = qty,
                    BadgeType = "PaidAddOn",
                    Label = $"+ {qty}x {normalized} (Paid Add-On)"
                });
            }

            // Build Route Display
            string routeDisplay = order.Fulfillment switch
            {
                FulfillmentType.Pickup => "🏪 Store Pickup",
                FulfillmentType.Lalamove => "📦 Lalamove",
                _ => $"🛵 {(order.DeliveryTrip != null && !string.IsNullOrWhiteSpace(order.DeliveryTrip.RiderName) ? order.DeliveryTrip.RiderName : "Unassigned")}"
            };

            // Build Item Type Display
            var itemSummaries = new List<string>();
            foreach (var item in order.OrderItems.Where(i => i.ItemCategory != null && i.ItemCategory.MinimumWeightKg > 0))
            {
                var categoryName = item.FulfilledItemCategory?.Name ?? item.ItemCategory!.Name;
                itemSummaries.Add($"{item.Quantity}x {categoryName}");
            }
            string typeItem = itemSummaries.Count > 0 ? string.Join(", ", itemSummaries) : "Sides Only";

            DateTime? timeNeeded = order.RiderDepartureTime ?? order.TargetDeliveryTime;
            string timeNeededDisplay = order.IsTimeTbd || !timeNeeded.HasValue
                ? "⏳ TIME TBD"
                : timeNeeded.Value.ToString("hh:mm tt");

            return new FreebiePrepRosterRowDto
            {
                Id = $"ord-{order.OrderReference}",
                RowType = "Order",
                OrderId = order.Id,
                IsPrepRequest = false,
                OrderRef = order.OrderReference.StartsWith("#") ? order.OrderReference : $"#{order.OrderReference}",
                OrderReference = order.OrderReference.StartsWith("#") ? order.OrderReference : $"#{order.OrderReference}",
                Recipient = order.CustomerName,
                CustomerName = order.CustomerName,
                FacebookName = order.FacebookName,
                TypeItem = typeItem,
                FulfillmentType = order.Fulfillment.ToString(),
                RouteDisplay = routeDisplay,
                RiderName = order.DeliveryTrip?.RiderName,
                TimeNeeded = timeNeeded,
                TimeNeededDisplay = timeNeededDisplay,
                IsTimeTbd = order.IsTimeTbd || !timeNeeded.HasValue,
                IsNoFreebies = isNoFreebies,
                IsRawInnards = isRawInnards,
                HasBellyCokeSwap = hasBellyCokeSwap,
                FreebiesSummary = order.FreebiesSummary,
                ChecklistPills = pills,
                Remarks = order.Remarks ?? string.Empty,
                CreatedBy = order.CreatedBy
            };
        }

        private (bool isNoFreebies, bool isRawInnards, bool hasBellyCokeSwap, Dictionary<string, int> counts, Dictionary<string, int> bellyCounts)
            ResolveFreebiesState(Order order, int wholePigCount, List<OrderItem> bellyItems)
        {
            bool isNoFreebies = false;
            bool isRawInnards = false;
            bool hasBellyCokeSwap = false;
            var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var bellyCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            // Try parsing FreebiesConfigJson first
            if (!string.IsNullOrWhiteSpace(order.FreebiesConfigJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(order.FreebiesConfigJson);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("optOut", out var optOutProp) && optOutProp.GetBoolean())
                        isNoFreebies = true;
                    if (root.TryGetProperty("mode", out var modeProp) && modeProp.GetString()?.Equals("none", StringComparison.OrdinalIgnoreCase) == true)
                        isNoFreebies = true;
                    if (root.TryGetProperty("pigsWithFreebies", out var pwfProp) && pwfProp.GetInt32() == 0 && wholePigCount > 0)
                        isNoFreebies = true;
                    if (root.TryGetProperty("rawInnards", out var rawProp) && rawProp.GetBoolean())
                        isRawInnards = true;

                    if (root.TryGetProperty("counts", out var countsProp) && countsProp.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in countsProp.EnumerateObject())
                        {
                            if (prop.Value.TryGetInt32(out int val)) counts[prop.Name] = val;
                        }
                    }

                    if (root.TryGetProperty("bellyCounts", out var bellyProp) && bellyProp.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in bellyProp.EnumerateObject())
                        {
                            if (prop.Value.TryGetInt32(out int val))
                            {
                                bellyCounts[prop.Name] = val;
                                if (prop.Name.Contains("Coke", StringComparison.OrdinalIgnoreCase) && val > 1)
                                {
                                    hasBellyCokeSwap = true;
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // Fallback to string scanning if JSON parse fails
                }
            }

            // Inspect FreebiesSummary and Remarks as secondary authority / fallback
            string combinedText = $"{order.FreebiesSummary ?? ""} {order.Remarks ?? ""}";
            if (!isNoFreebies && Regex.IsMatch(combinedText, @"no\s*freebies|less\s*(?:₱\s*)?2(?:,000|k)?", RegexOptions.IgnoreCase))
            {
                isNoFreebies = true;
            }
            if (!isRawInnards && Regex.IsMatch(combinedText, @"raw\s*innards|walang\s*dinuguan|hilaw|lamang-loob", RegexOptions.IgnoreCase))
            {
                isRawInnards = true;
            }
            if (!hasBellyCokeSwap && Regex.IsMatch(combinedText, @"coke|bilao\s*swapped|4\s*pcs\s*1\.5\s*coke", RegexOptions.IgnoreCase))
            {
                hasBellyCokeSwap = true;
            }

            // If bellyCounts empty but belly items present, derive default belly freebies
            if (bellyCounts.Count == 0 && bellyItems.Count > 0)
            {
                foreach (var belly in bellyItems)
                {
                    int kg = (int)Math.Round(belly.ItemCategory?.MinimumWeightKg ?? 2.0m);
                    int qty = belly.Quantity;
                    bellyCounts["Sarsa"] = bellyCounts.GetValueOrDefault("Sarsa") + qty;

                    if (kg == 2 || kg == 3)
                    {
                        bellyCounts["Dinuguan"] = bellyCounts.GetValueOrDefault("Dinuguan") + qty;
                    }
                    else if (kg == 4)
                    {
                        bellyCounts["Puto"] = bellyCounts.GetValueOrDefault("Puto") + qty;
                    }
                    else if (kg == 5)
                    {
                        // Check if swapped for Coke
                        if (hasBellyCokeSwap || Regex.IsMatch(combinedText, @"coke|bilao\s*swapped|4\s*pcs\s*1\.5\s*coke", RegexOptions.IgnoreCase))
                        {
                            hasBellyCokeSwap = true;
                            bellyCounts["1.5L Coke"] = bellyCounts.GetValueOrDefault("1.5L Coke") + (4 * qty);
                        }
                        else if (Regex.IsMatch(combinedText, @"palabok", RegexOptions.IgnoreCase))
                        {
                            bellyCounts["Palabok"] = bellyCounts.GetValueOrDefault("Palabok") + qty;
                        }
                        else
                        {
                            bellyCounts["Pancit"] = bellyCounts.GetValueOrDefault("Pancit") + qty;
                        }
                    }
                }
            }

            return (isNoFreebies, isRawInnards, hasBellyCokeSwap, counts, bellyCounts);
        }

        private Dictionary<string, int> ExtractPaidAddOns(Order order, List<OrderItem> paidAddOnItems)
        {
            var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            if (paidAddOnItems.Count > 0)
            {
                foreach (var item in paidAddOnItems)
                {
                    var name = item.ItemCategory?.Name ?? "Add-On";
                    var normalized = NormalizeSideItemName(name);
                    result[normalized] = result.GetValueOrDefault(normalized) + item.Quantity;
                }
            }
            else if (!string.IsNullOrWhiteSpace(order.AddOns) && order.AddOns != "-")
            {
                // Fallback: parse free-text AddOns string (e.g. "+ 1x Palabok", "Additional Sarsa (₱120)")
                var matches = Regex.Matches(order.AddOns, @"(?:(\d+)\s*x?\s*)?(Pancit|Palabok|Spaghetti|Dinuguan|Puto|Sarsa|Coke|Raw Innards)", RegexOptions.IgnoreCase);
                foreach (Match match in matches)
                {
                    int qty = 1;
                    if (match.Groups[1].Success && int.TryParse(match.Groups[1].Value, out int parsedQty))
                    {
                        qty = parsedQty;
                    }
                    var name = match.Groups[2].Value;
                    var normalized = NormalizeSideItemName(name);
                    result[normalized] = result.GetValueOrDefault(normalized) + qty;
                }
            }

            return result;
        }

        private static string NormalizeSideItemName(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
            var trimmed = raw.Trim();
            if (trimmed.Contains("Sarsa", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("Liver Sauce", StringComparison.OrdinalIgnoreCase))
                return "Sarsa";
            if (trimmed.Contains("Coke", StringComparison.OrdinalIgnoreCase))
                return "1.5L Coke";
            if (trimmed.Contains("Palabok", StringComparison.OrdinalIgnoreCase))
                return "Palabok";
            if (trimmed.Contains("Spaghetti", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("Spag", StringComparison.OrdinalIgnoreCase))
                return "Spaghetti";
            if (trimmed.Contains("Pancit", StringComparison.OrdinalIgnoreCase))
                return "Pancit";
            if (trimmed.Contains("Dinuguan", StringComparison.OrdinalIgnoreCase))
                return "Dinuguan";
            if (trimmed.Contains("Puto", StringComparison.OrdinalIgnoreCase))
                return "Puto";
            if (trimmed.Contains("Raw", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("Lamang", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("Hilaw", StringComparison.OrdinalIgnoreCase))
                return "Raw Innards";
            return trimmed;
        }

        private static Dictionary<string, int> DeserializePrepItems(string itemsJson)
        {
            var dict = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(itemsJson)) return dict;

            try
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, int>>(itemsJson);
                if (parsed != null)
                {
                    foreach (var kvp in parsed) dict[kvp.Key] = kvp.Value;
                }
            }
            catch
            {
                // Ignore JSON parse errors for corrupted manual edits
            }

            return dict;
        }
    }
}
