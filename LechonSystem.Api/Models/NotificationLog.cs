namespace LechonSystem.Api.Models
{
    public class NotificationLog : BaseEntity
    {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string RecipientPhone { get; set; } = string.Empty;
        public string MessageBody { get; set; } = string.Empty;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public bool IsSuccess { get; set; }
    }
}