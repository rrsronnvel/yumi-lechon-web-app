using LechonSystem.Api.Interfaces;

namespace LechonSystem.Api.Services
{
    // THE POWER PLANT: This is the actual code that runs when the socket is used.
    public class SmsNotificationService : INotificationSender
    {
        public Task<bool> SendMessageAsync(string phoneNumber, string message)
        {
            // For now, we just simulate sending a text by printing it to the developer console.
            Console.WriteLine("========================================");
            Console.WriteLine($"📱 SMS DISPATCHED TO: {phoneNumber}");
            Console.WriteLine($"✉️ MESSAGE: {message}");
            Console.WriteLine("========================================");
            
            // Return true to pretend the message successfully went through the cell towers.
            return Task.FromResult(true); 
        }
    }
}