namespace LechonSystem.Api.Services;

public sealed record ExpenseClassification(string Category, string CostType);

public static class ExpenseCategorizer
{
    public const string Meat = "Meat / Main Products";
    public const string Ingredients = "Ingredients & Freebies";
    public const string Packaging = "Packaging";
    public const string Fuel = "Fuel";
    public const string Utilities = "Utilities";
    public const string Labor = "Labor";
    public const string Rent = "Rent";
    public const string Equipment = "Equipment & Supplies";
    public const string Taxes = "Taxes and Government Fees";
    public const string Marketing = "Marketing";
    public const string StaffMeal = "Staff Meal";
    public const string Others = "Others";
    public const string OwnerOutflow = "Owner / Non-Operating Outflow";

    public const string Cogs = "COGS";
    public const string Opex = "OPEX";
    public const string NonOperating = "NON_OP";

    public static readonly IReadOnlyList<string> Categories =
    [
        Meat, Ingredients, Packaging, Fuel, Utilities, Labor, Rent, Equipment,
        Taxes, Marketing, StaffMeal, Others, OwnerOutflow
    ];

    private static readonly IReadOnlyDictionary<string, string> CostTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [Meat] = Cogs,
            [Ingredients] = Cogs,
            [Packaging] = Cogs,
            [Fuel] = Opex,
            [Utilities] = Opex,
            [Labor] = Opex,
            [Rent] = Opex,
            [Equipment] = Opex,
            [Taxes] = Opex,
            [Marketing] = Opex,
            [StaffMeal] = Opex,
            [Others] = Opex,
            [OwnerOutflow] = NonOperating
        };

    // Ordered deliberately: packaging must win over the generic word "belly".
    private static readonly (string Category, string[] Keywords)[] Rules =
    [
        (Packaging, ["bilao", "belly box", "manila paper", "packaging", "tape", "foil", "microwavable", "plastic box"]),
        (Meat, ["live pig", "buong baboy", "baboy", "biik", "lechon belly", "belly", "manok", "chicken"]),
        (Ingredients, ["coke", "palabok", "bihon", "canton", "cantos", "spaghetti", "puto", "kikiam", "sqb", "squid ball", "mantika", "asin", "sibuyas", "bawang", "luya", "sili", "labuyo", "panigang", "repolyo", "carrot", "calamansi", "kamatis", "munggo", "tuyo", "puregold", "osave", "seasoning", "creamer", "condense", "tubig", "mineral", "upo", "kinchay", "talong", "beans", "carrots"]),
        (Fuel, ["gasolina", "gasoline", "diesel", "fuel", "petron", "shell"]),
        (Labor, ["salary", "sahod", "sweldo", "bale", "manpower", "katay"]),
        (Utilities, ["meralco", "kuryente", "maynilad", "primewater", "pldt", "globe", "converge", "lpg"]),
        (Rent, ["rent", "upa"]),
        (Marketing, ["meta verified", "fb ads", "print", "tarpaulin"]),
        (StaffMeal, ["staff meal", "sacks of rice", "ulam"]),
        (Equipment, ["uling", "charcoal", "tablet", "desktop pc", "timba", "dishwashing", "diswashing", "macrame", "yarn"]),
        (OwnerOutflow, ["resort dp", "paluwagan", "tita elay", "owner draw", "personal"])
    ];

    public static ExpenseClassification? TryClassify(string? itemDescription)
    {
        if (string.IsNullOrWhiteSpace(itemDescription)) return null;
        var value = itemDescription.Trim().ToLowerInvariant();

        foreach (var (category, keywords) in Rules)
        {
            if (keywords.Any(value.Contains))
            {
                return new ExpenseClassification(category, GetCostType(category));
            }
        }

        return null;
    }

    public static string NormalizeCategory(string? category)
    {
        var canonical = Categories.FirstOrDefault(candidate =>
            string.Equals(candidate, category?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (canonical == null)
        {
            throw new ArgumentException($"Category must be one of: {string.Join(", ", Categories)}.");
        }

        return canonical;
    }

    public static string GetCostType(string category)
    {
        var canonical = NormalizeCategory(category);
        return CostTypes[canonical];
    }
}
