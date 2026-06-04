using System.Threading.Tasks;
using LechonSystem.Api.Data;
using LechonSystem.Api.Models;
using LechonSystem.Api.DTOs;
using System.Linq;

namespace LechonSystem.Api.Services
{
    public class OrderService
    {
        private readonly LechonDbContext _context;

        // 1. Inject the Database Context
        public OrderService(LechonDbContext context)
        {
            _context = context;
        }

        // 2. The core ingestion method
        public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
        {
            // Translate DTO to Domain Entity
            var newOrder = new Order
            {
                CustomerName = request.CustomerName,
                ContactNumber = request.ContactNumber,
                Source = request.Source,
                TargetDeliveryTime = request.TargetDeliveryTime,
                
                // Enforce the initial business rule
                IsDeliveryDetailsConfirmed = false 
            };

            // Map the items
            if (request.Items != null && request.Items.Any())
            {
                foreach (var item in request.Items)
                {
                    newOrder.OrderItems.Add(new OrderItem
                    {
                        ItemCategoryId = item.ItemCategoryId,
                        Quantity = item.Quantity,
                        // Note: We leave TotalPrice at 0 for now. 
                        // In Milestone 2, we will look up the BasePrice from the DB here!
                    });
                }
            }

            // Save to SQL Server
            _context.Orders.Add(newOrder);
            await _context.SaveChangesAsync();

            return newOrder;
        }
    }
}