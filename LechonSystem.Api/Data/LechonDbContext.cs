using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Models;

namespace LechonSystem.Api.Data;

public class LechonDbContext : DbContext
{
    public LechonDbContext(DbContextOptions<LechonDbContext> options) : base(options)
    {
    }

    public DbSet<ItemCategory> ItemCategories { get; set; } = null!;
    public DbSet<ProductCookingProfile> ProductCookingProfiles { get; set; } = null!;
    public DbSet<Order> Orders { get; set; } = null!;
    public DbSet<OrderItem> OrderItems { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Explicitly define a completely static date to override the BaseEntity default
        var seedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // 1. Seed Item Categories with explicitly pinned CreatedAt times
        modelBuilder.Entity<ItemCategory>().HasData(
            new ItemCategory { Id = 1, Name = "Small Whole", MinimumWeightKg = 13.0m, MaximumWeightKg = 20.9m, BasePrice = 4500.00m, CreatedAt = seedDate },
            new ItemCategory { Id = 2, Name = "Medium Whole", MinimumWeightKg = 21.0m, MaximumWeightKg = 25.9m, BasePrice = 5500.00m, CreatedAt = seedDate },
            new ItemCategory { Id = 3, Name = "Large Whole", MinimumWeightKg = 26.0m, MaximumWeightKg = 30.9m, BasePrice = 6500.00m, CreatedAt = seedDate },
            new ItemCategory { Id = 4, Name = "Lechon Belly - Medium", MinimumWeightKg = 4.0m, MaximumWeightKg = 5.9m, BasePrice = 2500.00m, CreatedAt = seedDate }
        );

        // 2. Seed Product Cooking Profiles with explicitly pinned CreatedAt times
        modelBuilder.Entity<ProductCookingProfile>().HasData(
            new ProductCookingProfile { Id = 1, ItemCategoryId = 1, Name = "Small Profile", Description = "Small whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 120, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 2, ItemCategoryId = 2, Name = "Medium Profile", Description = "Medium whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 180, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 3, ItemCategoryId = 3, Name = "Large Profile", Description = "Large whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 240, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 4, ItemCategoryId = 4, Name = "Belly Profile", Description = "Standard belly duration metrics", TahiDurationMinutes = 30, SalangDurationMinutes = 90, PackagingDurationMinutes = 15, CreatedAt = seedDate }
        );
    }
}