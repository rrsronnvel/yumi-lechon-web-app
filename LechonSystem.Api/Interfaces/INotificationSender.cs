namespace LechonSystem.Api.Interfaces
{
    // THE WALL SOCKET: Anyone who claims to be a Notification Sender MUST have this method.
    public interface INotificationSender
    {
        Task<bool> SendMessageAsync(string phoneNumber, string message);
    }
}