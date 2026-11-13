export const EXPENSE_CATEGORIES = [
  "Meat / Main Products",
  "Ingredients & Freebies",
  "Packaging",
  "Fuel",
  "Utilities",
  "Labor",
  "Rent",
  "Equipment & Supplies",
  "Taxes and Government Fees",
  "Marketing",
  "Staff Meal",
  "Others",
  "Owner / Non-Operating Outflow",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseCostType = "COGS" | "OPEX" | "NON_OP";

export const CATEGORY_COST_TYPES: Record<ExpenseCategory, ExpenseCostType> = {
  "Meat / Main Products": "COGS",
  "Ingredients & Freebies": "COGS",
  Packaging: "COGS",
  Fuel: "OPEX",
  Utilities: "OPEX",
  Labor: "OPEX",
  Rent: "OPEX",
  "Equipment & Supplies": "OPEX",
  "Taxes and Government Fees": "OPEX",
  Marketing: "OPEX",
  "Staff Meal": "OPEX",
  Others: "OPEX",
  "Owner / Non-Operating Outflow": "NON_OP",
};

type CategoryRule = {
  category: ExpenseCategory;
  keywords: readonly string[];
};

// Rule order is accounting policy. Packaging intentionally precedes meat so
// "Lechon Belly Box" is never classified as a raw belly purchase.
export const EXPENSE_CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: "Packaging",
    keywords: [
      "bilao",
      "belly box",
      "manila paper",
      "packaging",
      "tape",
      "foil",
      "microwavable",
      "plastic box",
    ],
  },
  {
    category: "Meat / Main Products",
    keywords: [
      "live pig",
      "buong baboy",
      "baboy",
      "biik",
      "lechon belly",
      "belly",
      "manok",
      "chicken",
    ],
  },
  {
    category: "Ingredients & Freebies",
    keywords: [
      "coke",
      "palabok",
      "bihon",
      "canton",
      "cantos",
      "spaghetti",
      "puto",
      "kikiam",
      "sqb",
      "squid ball",
      "mantika",
      "asin",
      "sibuyas",
      "bawang",
      "luya",
      "sili",
      "labuyo",
      "panigang",
      "repolyo",
      "carrot",
      "calamansi",
      "kamatis",
      "munggo",
      "tuyo",
      "puregold",
      "osave",
      "seasoning",
      "creamer",
      "condense",
      "tubig",
      "mineral",
      "upo",
      "kinchay",
      "talong",
      "beans",
      "carrots",
    ],
  },
  {
    category: "Fuel",
    keywords: ["gasolina", "gasoline", "diesel", "fuel", "petron", "shell"],
  },
  {
    category: "Labor",
    keywords: ["salary", "sahod", "sweldo", "bale", "manpower", "katay"],
  },
  {
    category: "Utilities",
    keywords: ["meralco", "kuryente", "maynilad", "primewater", "pldt", "globe", "converge", "lpg"],
  },
  { category: "Rent", keywords: ["rent", "upa"] },
  {
    category: "Marketing",
    keywords: ["meta verified", "fb ads", "print", "tarpaulin"],
  },
  {
    category: "Staff Meal",
    keywords: ["staff meal", "sacks of rice", "ulam"],
  },
  {
    category: "Equipment & Supplies",
    keywords: [
      "uling",
      "charcoal",
      "tablet",
      "desktop pc",
      "timba",
      "dishwashing",
      "diswashing",
      "macrame",
      "yarn",
    ],
  },
  {
    category: "Owner / Non-Operating Outflow",
    keywords: ["resort dp", "paluwagan", "tita elay", "owner draw", "personal"],
  },
] as const;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export function categorizeExpense(description: string): ExpenseCategory | null {
  const normalizedDescription = normalize(description);
  if (!normalizedDescription) return null;

  for (const rule of EXPENSE_CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => normalizedDescription.includes(normalize(keyword)))) {
      return rule.category;
    }
  }

  return null;
}

export function getExpenseCostType(category: ExpenseCategory): ExpenseCostType {
  return CATEGORY_COST_TYPES[category];
}
