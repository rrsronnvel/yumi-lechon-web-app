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
    public DbSet<OrderItemSchedule> OrderItemSchedules { get; set; }

    public DbSet<InventoryReservation> InventoryReservations { get; set; }

    public DbSet<InventoryTransaction> InventoryTransactions { get; set; }

    public DbSet<DeliveryTrip> DeliveryTrips { get; set; }
    public DbSet<NotificationLog> NotificationLogs { get; set; }
    public DbSet<PaymentLog> PaymentLogs { get; set; }
    public DbSet<PurchaseOrder> PurchaseOrders { get; set; }
    public DbSet<PurchaseOrderItem> PurchaseOrderItems { get; set; }
    public DbSet<PriceHistoryLog> PriceHistoryLogs { get; set; }
    public DbSet<OrderAuditLog> OrderAuditLogs { get; set; }
    public DbSet<Rider> Riders => Set<Rider>();
    public DbSet<User> Users => Set<User>();
    public DbSet<SettlementQrSession> SettlementQrSessions => Set<SettlementQrSession>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Explicitly define a completely static date to override the BaseEntity default
        var seedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // 1. Seed Item Categories with explicitly pinned CreatedAt times
        modelBuilder.Entity<ItemCategory>().HasData(
            // A. Whole Lechon
            new ItemCategory { Id = 1, Name = "XXS", MinimumWeightKg = 13.0m, MaximumWeightKg = 15.0m, BasePrice = 10000.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 2, Name = "XS", MinimumWeightKg = 16.0m, MaximumWeightKg = 19.0m, BasePrice = 11000.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 3, Name = "S", MinimumWeightKg = 20.0m, MaximumWeightKg = 21.0m, BasePrice = 12000.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 4, Name = "M", MinimumWeightKg = 22.0m, MaximumWeightKg = 24.0m, BasePrice = 12700.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 5, Name = "L", MinimumWeightKg = 25.0m, MaximumWeightKg = 27.0m, BasePrice = 13500.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 6, Name = "XL", MinimumWeightKg = 28.0m, MaximumWeightKg = 30.0m, BasePrice = 14000.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 7, Name = "XXL", MinimumWeightKg = 32.0m, MaximumWeightKg = 35.0m, BasePrice = 15000.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 8, Name = "Jumbo", MinimumWeightKg = 37.0m, MaximumWeightKg = 40.0m, BasePrice = 16500.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 9, Name = "S. Jumbo", MinimumWeightKg = 41.0m, MaximumWeightKg = 45.0m, BasePrice = 17500.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },

            // Lechon Bellies
            new ItemCategory { Id = 10, Name = "Belly 2kg", MinimumWeightKg = 2.0m, MaximumWeightKg = 2.0m, BasePrice = 1700.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 11, Name = "Belly 3kg", MinimumWeightKg = 3.0m, MaximumWeightKg = 3.0m, BasePrice = 2500.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 12, Name = "Belly 4kg", MinimumWeightKg = 4.0m, MaximumWeightKg = 4.0m, BasePrice = 3300.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 13, Name = "Belly 5kg", MinimumWeightKg = 5.0m, MaximumWeightKg = 5.0m, BasePrice = 4200.00m, MinimumSafetyStock = 3, IsActive = true, CreatedAt = seedDate },

            // B. Lightweight Add-Ons (Weights 0.0kg, BasePrice 50.00, MinimumSafetyStock 0, IsActive true)
            new ItemCategory { Id = 14, Name = "Sarsa", MinimumWeightKg = 0.0m, MaximumWeightKg = 0.0m, BasePrice = 50.00m, MinimumSafetyStock = 0, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 15, Name = "1.5 L coke", MinimumWeightKg = 0.0m, MaximumWeightKg = 0.0m, BasePrice = 50.00m, MinimumSafetyStock = 0, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 16, Name = "Pancit", MinimumWeightKg = 0.0m, MaximumWeightKg = 0.0m, BasePrice = 50.00m, MinimumSafetyStock = 0, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 17, Name = "Palabok", MinimumWeightKg = 0.0m, MaximumWeightKg = 0.0m, BasePrice = 50.00m, MinimumSafetyStock = 0, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 18, Name = "Spaghetti", MinimumWeightKg = 0.0m, MaximumWeightKg = 0.0m, BasePrice = 50.00m, MinimumSafetyStock = 0, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 19, Name = "Dinuguan", MinimumWeightKg = 0.0m, MaximumWeightKg = 0.0m, BasePrice = 50.00m, MinimumSafetyStock = 0, IsActive = true, CreatedAt = seedDate },
            new ItemCategory { Id = 20, Name = "Puto", MinimumWeightKg = 0.0m, MaximumWeightKg = 0.0m, BasePrice = 50.00m, MinimumSafetyStock = 0, IsActive = true, CreatedAt = seedDate }
        );

        // 2. Seed Product Cooking Profiles with explicitly pinned CreatedAt times
        modelBuilder.Entity<ProductCookingProfile>().HasData(
            // Whole Lechon (Tahi: 60 mins, Packaging: 30 mins)
            new ProductCookingProfile { Id = 1, ItemCategoryId = 1, Name = "XXS Profile", Description = "XXS whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 150, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 2, ItemCategoryId = 2, Name = "XS Profile", Description = "XS whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 150, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 3, ItemCategoryId = 3, Name = "S Profile", Description = "Small whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 150, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 4, ItemCategoryId = 4, Name = "M Profile", Description = "Medium whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 180, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 5, ItemCategoryId = 5, Name = "L Profile", Description = "Large whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 180, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 6, ItemCategoryId = 6, Name = "XL Profile", Description = "XL whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 210, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 7, ItemCategoryId = 7, Name = "XXL Profile", Description = "XXL whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 225, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 8, ItemCategoryId = 8, Name = "Jumbo Profile", Description = "Jumbo whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 270, PackagingDurationMinutes = 30, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 9, ItemCategoryId = 9, Name = "S. Jumbo Profile", Description = "S. Jumbo whole pig duration metrics", TahiDurationMinutes = 60, SalangDurationMinutes = 300, PackagingDurationMinutes = 30, CreatedAt = seedDate },

            // Lechon Belly (Tahi: 30 mins, Packaging: 15 mins)
            new ProductCookingProfile { Id = 10, ItemCategoryId = 10, Name = "Belly 2kg Profile", Description = "Belly 2kg duration metrics", TahiDurationMinutes = 30, SalangDurationMinutes = 120, PackagingDurationMinutes = 15, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 11, ItemCategoryId = 11, Name = "Belly 3kg Profile", Description = "Belly 3kg duration metrics", TahiDurationMinutes = 30, SalangDurationMinutes = 120, PackagingDurationMinutes = 15, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 12, ItemCategoryId = 12, Name = "Belly 4kg Profile", Description = "Belly 4kg duration metrics", TahiDurationMinutes = 30, SalangDurationMinutes = 120, PackagingDurationMinutes = 15, CreatedAt = seedDate },
            new ProductCookingProfile { Id = 13, ItemCategoryId = 13, Name = "Belly 5kg Profile", Description = "Belly 5kg duration metrics", TahiDurationMinutes = 30, SalangDurationMinutes = 135, PackagingDurationMinutes = 15, CreatedAt = seedDate }
        );

        // 3. Seed Regular Freelance Riders
        modelBuilder.Entity<Rider>().HasData(
            new Rider { Id = 1, FullName = "Kuya Berto", PhoneNumber = "09171234567", IsActive = true, CreatedAt = seedDate },
            new Rider { Id = 2, FullName = "Kuya Jun", PhoneNumber = "09182345678", IsActive = true, CreatedAt = seedDate },
            new Rider { Id = 3, FullName = "Kuya AL", PhoneNumber = "09193456789", IsActive = true, CreatedAt = seedDate }
        );

        // 4. Seed Initial User Accounts
        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = 1,
                Username = "owner",
                PasswordHash = "$2a$11$91qvtqitWclA.BB1pUEmsezQaloAyJi23suOIbEIT1JEZmSeqLB6S",
                FullName = "Business Owner",
                Role = "Owner",
                IsActive = true,
                CreatedAt = seedDate
            },
            new User
            {
                Id = 2,
                Username = "cashier",
                PasswordHash = "$2a$11$pWVefaVk/s0XTuGmg2GCCujzhLECelvzDiuenEDPva86K6zlzWQlW",
                FullName = "Store Cashier",
                Role = "Cashier",
                IsActive = true,
                CreatedAt = seedDate
            }
        );

        // 5. Seed Default Delivery Pricing System Settings
        modelBuilder.Entity<SystemSetting>().HasData(
            new SystemSetting { Id = 1, SettingKey = "DeliveryFeeBaseFare", SettingValue = "100.00", UpdatedBy = "System", UpdatedAt = seedDate },
            new SystemSetting { Id = 2, SettingKey = "DeliveryFeeRatePerKm", SettingValue = "15.00", UpdatedBy = "System", UpdatedAt = seedDate }
        );

        modelBuilder.Entity<PaymentLog>()
                .HasIndex(p => p.GatewayReferenceId)
                .IsUnique();

        modelBuilder.Entity<SettlementQrSession>()
                .HasIndex(s => s.Token)
                .IsUnique();
    }
}
