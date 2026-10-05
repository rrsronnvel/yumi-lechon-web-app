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

        modelBuilder.Entity<PaymentLog>()
                .HasIndex(p => p.GatewayReferenceId)
                .IsUnique();
    }
}