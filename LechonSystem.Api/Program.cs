using Microsoft.EntityFrameworkCore;
using LechonSystem.Api.Data;
using LechonSystem.Api.Services;
using LechonSystem.Api.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// PHASE 1: THE CONFIGURATION MIXING BOWL
// All 'builder.Services' must stay up here!
// ==========================================

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<LechonDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ISchedulingService, SchedulingService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IRoastingService, RoastingService>();
builder.Services.AddScoped<ILogisticsService, LogisticsService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<IProcurementService, ProcurementService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<INotificationSender, SmsNotificationService>();

// 🟢 MOVE CORS CONFIGURATION HERE (Before builder.Build)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173") 
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddOpenApi();

// ==========================================
// THE POINT OF NO RETURN
// This bakes the services container permanently
// ==========================================
var app = builder.Build(); 

// ==========================================
// PHASE 2: THE REQUEST PIPELINE (MIDDLEWARE)
// All 'app.Use...' statements stay down here!
// ==========================================

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 🟢 Use CORS right before mapping routes
app.UseCors("AllowReactApp"); 
app.UseAuthorization();
app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}