using LechonSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LechonSystem.Api.Data;

/// <summary>
/// Additive defaults for the seasonal promotion CMS. Existing rows are never
/// overwritten so Owner customizations survive every application restart.
/// </summary>
public static class PromoPackageSeed
{
    public static async Task SeedAsync(
        LechonDbContext context,
        CancellationToken cancellationToken = default)
    {
        var existingCodes = await context.PromoPackages
            .AsNoTracking()
            .Select(promo => promo.Code)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase, cancellationToken);

        var missing = Defaults()
            .Where(promo => !existingCodes.Contains(promo.Code))
            .ToList();

        if (missing.Count == 0)
        {
            return;
        }

        context.PromoPackages.AddRange(missing);
        await context.SaveChangesAsync(cancellationToken);
    }

    private static IEnumerable<PromoPackage> Defaults()
    {
        yield return Package(
            "REGULAR_7", "Regular", "Standard 7 Freebies",
            "Regular", 0m,
            "{\"Sarsa\":1,\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Dinuguan\":1,\"Puto\":1,\"1.5L Coke\":1}",
            10,
            "Sarsa, Pancit, Palabok, Spaghetti, Dinuguan, Puto, and 1.5L Coke per Whole Lechon.");

        yield return Package(
            "REGULAR_LESS_2K", "Regular", "No Freebies (Less ₱2,000)",
            "Regular", 2000m, "{\"Sarsa\":1}", 20,
            "₱2,000 cash discount per Whole Lechon with one Liver Sauce.");

        yield return Package(
            "DEC_OPT1_PANCIT_DINUGUAN", "Option 1", "Option 1 – Pancit + Dinuguan",
            "DecemberRegular", 0m,
            "{\"Pancit\":1,\"Fried Chicken\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Dinuguan\":1,\"Shanghai\":1}",
            110);
        yield return Package(
            "DEC_OPT1_PANCIT_BOPIS", "Option 1", "Option 1 – Pancit + Bopis",
            "DecemberRegular", 0m,
            "{\"Pancit\":1,\"Fried Chicken\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Bopis\":1,\"Shanghai\":1}",
            120);
        yield return Package(
            "DEC_OPT1_PALABOK_DINUGUAN", "Option 1", "Option 1 – Palabok + Dinuguan",
            "DecemberRegular", 0m,
            "{\"Palabok\":1,\"Fried Chicken\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Dinuguan\":1,\"Shanghai\":1}",
            130);
        yield return Package(
            "DEC_OPT1_PALABOK_BOPIS", "Option 1", "Option 1 – Palabok + Bopis",
            "DecemberRegular", 0m,
            "{\"Palabok\":1,\"Fried Chicken\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Bopis\":1,\"Shanghai\":1}",
            140);

        yield return Package(
            "DEC_OPT2_CHICKEN_DINUGUAN", "Option 2", "Option 2 – Chicken + Dinuguan",
            "DecemberRegular", 0m,
            "{\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Fried Chicken\":1,\"Dinuguan\":1}",
            210);
        yield return Package(
            "DEC_OPT2_CHICKEN_BOPIS", "Option 2", "Option 2 – Chicken + Bopis",
            "DecemberRegular", 0m,
            "{\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Fried Chicken\":1,\"Bopis\":1}",
            220);
        yield return Package(
            "DEC_OPT2_SHANGHAI_DINUGUAN", "Option 2", "Option 2 – Shanghai + Dinuguan",
            "DecemberRegular", 0m,
            "{\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Shanghai\":1,\"Dinuguan\":1}",
            230);
        yield return Package(
            "DEC_OPT2_SHANGHAI_BOPIS", "Option 2", "Option 2 – Shanghai + Bopis",
            "DecemberRegular", 0m,
            "{\"Pancit\":1,\"Palabok\":1,\"Spaghetti\":1,\"Puto\":1,\"Sarsa\":1,\"Shanghai\":1,\"Bopis\":1}",
            240);

        yield return Package(
            "DEC_OPT3_LESS_2K", "Option 3", "Option 3 – ₱2,000 Cash Discount",
            "DecemberRegular", 2000m, "{\"Sarsa\":1}", 310,
            "₱2,000 cash discount per Whole Lechon with one Liver Sauce.");

        yield return Package(
            "DEC_PEAK_DINUGUAN", "Dec 24 & 31 Peak", "Dec 24/31 – Dinuguan",
            "DecemberPeak", 0m,
            "{\"Puto\":1,\"Dinuguan\":1,\"1.5L Coke\":1,\"Sarsa\":1}",
            410,
            "40 pcs Puto, Dinuguan, 1.5L Coke, and Liver Sauce per Whole Lechon.");
        yield return Package(
            "DEC_PEAK_BOPIS", "Dec 24 & 31 Peak", "Dec 24/31 – Bopis",
            "DecemberPeak", 0m,
            "{\"Puto\":1,\"Bopis\":1,\"1.5L Coke\":1,\"Sarsa\":1}",
            420,
            "40 pcs Puto, Bopis, 1.5L Coke, and Liver Sauce per Whole Lechon.");
    }

    private static PromoPackage Package(
        string code,
        string groupName,
        string name,
        string seasonScope,
        decimal discountAmount,
        string includedItemsJson,
        int sortOrder,
        string? description = null) => new()
        {
            Code = code,
            GroupName = groupName,
            Name = name,
            Description = description,
            SeasonScope = seasonScope,
            DiscountAmount = discountAmount,
            IncludedItemsJson = includedItemsJson,
            AllowOnPeakDates = false,
            IsActive = true,
            SortOrder = sortOrder
        };
}
