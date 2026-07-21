using System.ComponentModel.DataAnnotations;

namespace LechonSystem.Api.DTOs
{
    public class UpdatePriceRequest
    {
        [Required]
        [Range(0.01, 100000.00, ErrorMessage = "Price must be greater than zero.")]
        public decimal NewPrice { get; set; }

        // We will make this optional, but it's good practice to pass the user's name
        public string? AdminName { get; set; } 
    }
}