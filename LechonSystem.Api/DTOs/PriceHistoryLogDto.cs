using System;

namespace LechonSystem.Api.DTOs;

public class PriceHistoryLogDto
{
    public int Id { get; set; }
    public int ItemCategoryId { get; set; }
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public decimal Delta => NewPrice - OldPrice;
    public string? ChangedBy { get; set; }
    public DateTime DateChanged { get; set; }
}
