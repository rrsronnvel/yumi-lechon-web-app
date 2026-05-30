using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Data;

public class LechonDbContext : DbContext
{
    public LechonDbContext(DbContextOptions<LechonDbContext> options) : base(options)
    {
    }

    // These represent the physical tables that will be generated in SQL Server Express
    public DbSet<ItemCategory> ItemCategories { get; set; } = null!;
    public DbSet<ProductCookingProfile> ProductCookingProfiles { get; set; } = null!;
    public DbSet<Order> Orders { get; set; } = null!;
    public DbSet<OrderItem> OrderItems { get; set; } = null!;
}