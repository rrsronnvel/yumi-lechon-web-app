using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LechonSystem.Api.Models
{
    public class PriceHistoryLog : BaseEntity
    {

        public int Id { get; set; }

        [Required]
        public int ItemCategoryId { get; set; }
        
        // Navigation property mapping back to the exact Lechon category
        [ForeignKey("ItemCategoryId")]
        public ItemCategory ItemCategory { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal OldPrice { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal NewPrice { get; set; }

        // Nullable because a system process might trigger a change, though usually an Admin
        public string? ChangedBy { get; set; }

        [Required]
        public DateTime DateChanged { get; set; }
    }
}