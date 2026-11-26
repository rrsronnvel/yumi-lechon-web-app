import { sanitizeMojibake } from "./sanitizeDisplayText.ts";

export const FREEBIE_ITEMS = [
  "Sarsa",
  "1.5L Coke",
  "Pancit",
  "Palabok",
  "Spaghetti",
  "Dinuguan",
  "Puto",
] as const;

export type FreebieItem = (typeof FREEBIE_ITEMS)[number];

export const PROMO_FREEBIE_ITEMS = [
  "Sarsa",
  "Pancit",
  "Palabok",
  "Spaghetti",
  "Dinuguan",
  "Bopis",
  "Fried Chicken",
  "Shanghai",
  "Puto",
  "1.5L Coke",
] as const;

export type PromoFreebieItem = (typeof PROMO_FREEBIE_ITEMS)[number];

export type PromoDateKind = "regular" | "decemberRegular" | "decemberPeak";

export const getPromoDateKind = (date?: string | null): PromoDateKind => {
  const match = date?.slice(0, 10).match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match || Number(match[1]) !== 12) return "regular";
  const day = Number(match[2]);
  return day === 24 || day === 31 ? "decemberPeak" : "decemberRegular";
};

export const parsePromoIncludedItems = (
  json?: string | null,
): Record<string, number> => {
  try {
    const parsed = JSON.parse(json || "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))])
        .filter(([, value]) => Number(value) > 0),
    );
  } catch {
    return {};
  }
};

export const formatPromoIncludedItems = (
  items: Record<string, number>,
): string[] => Object.entries(items)
  .filter(([, quantity]) => quantity > 0)
  .map(([item, quantity]) => `${quantity}x ${item}`);

export const createPromoPackageCounts = (
  includedItems: Record<string, number>,
  wholePigCount: number,
): Record<string, number> => {
  const multiplier = Math.max(0, Math.floor(wholePigCount));
  return Object.fromEntries(
    PROMO_FREEBIE_ITEMS.map((item) => [
      item,
      Math.max(0, Math.floor(Number(includedItems[item]) || 0)) * multiplier,
    ]),
  );
};

export const normalizePromoCounts = (
  counts?: Record<string, number> | null,
): Record<string, number> => Object.fromEntries(
  PROMO_FREEBIE_ITEMS.map((item) => [
    item,
    Math.max(0, Math.floor(Number(counts?.[item]) || 0)),
  ]),
);

export const getPromoSlotsUsed = (counts?: Record<string, number> | null): number =>
  PROMO_FREEBIE_ITEMS.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(Number(counts?.[item]) || 0)),
    0,
  );

export const formatPromoBadge = (
  code?: string | null,
  label?: string | null,
  customized = false,
): string | null => {
  if (!code && !label) return null;
  if (code === "DEC_OPT3_LESS_2K") {
    return "🎄 Option 3 (Less ₱2k) • 1x Sarsa Only";
  }
  const customSuffix = customized && !/custom(?:ized|\s+swap)/i.test(label || "")
    ? " • Custom Swap"
    : "";
  return `${code?.startsWith("DEC_") ? "🎄" : "🎁"} ${label || code}${customSuffix}`;
};

export const parsePromoCustomization = (
  configJson?: string | null,
): { customized: boolean; counts: Record<string, number> } => {
  if (!configJson) return { customized: false, counts: normalizePromoCounts() };
  try {
    const parsed = JSON.parse(configJson) as Partial<FreebiesConfig>;
    return {
      customized: parsed.promoCustomized === true,
      counts: normalizePromoCounts(parsed.promoCounts),
    };
  } catch {
    return { customized: false, counts: normalizePromoCounts() };
  }
};

export function getOrderPromoItems(
  configJson: string | null | undefined,
  includedItemsJson: string | null | undefined,
  wholePigCount: number,
): string[] {
  try {
    const config = JSON.parse(configJson || "{}") as Record<string, unknown>;
    const saved = config.promoCounts;
    if (saved && typeof saved === "object") {
      const items = formatPromoIncludedItems(parsePromoIncludedItems(JSON.stringify(saved)));
      if (items.length || config.promoCustomized === true) return items;
    }
    if (config.promoCustomized === true) {
      for (const key of ["wholeLechonFreebies", "wholeLechonFreebiesJson", "counts"]) {
        const value = config[key];
        if (value) {
          return formatPromoIncludedItems(parsePromoIncludedItems(
            typeof value === "string" ? value : JSON.stringify(value),
          ));
        }
      }
    }
  } catch {
    // Orders without a readable allocation can use the selected package.
  }
  return formatPromoIncludedItems(Object.fromEntries(
    Object.entries(parsePromoIncludedItems(includedItemsJson))
      .map(([item, quantity]) => [item, quantity * Math.max(0, wholePigCount)]),
  ));
}

export const formatPromoOrderFreebiesSummary = (
  promoCode: string | null | undefined,
  promoLabel: string | null | undefined,
  inputConfig: FreebiesConfig,
  wholePigCount: number,
  noFreebiesDiscountPerPig: number,
  bellyItems: BellyFreebieSource[] = [],
): string | null => {
  if (!promoCode?.startsWith("DEC_")) {
    return formatFreebiesSummary(
      inputConfig,
      wholePigCount,
      noFreebiesDiscountPerPig,
      bellyItems,
    );
  }

  const parts = [formatPromoBadge(promoCode, promoLabel)].filter(Boolean) as string[];
  if (inputConfig.promoCustomized) {
    const customItems = PROMO_FREEBIE_ITEMS
      .filter((item) => (inputConfig.promoCounts?.[item] ?? 0) > 0)
      .map((item) => `${inputConfig.promoCounts?.[item]}x ${item}`);
    parts[0] = `${parts[0]} • Custom Swap`;
    if (customItems.length > 0) parts.push(customItems.join(", "));
  }
  if (bellyItems.length > 0) {
    const normalized = normalizeFreebiesConfig(inputConfig, wholePigCount, bellyItems);
    const selected = FREEBIE_ITEMS
      .filter((item) => (normalized.bellyCounts?.[item] ?? 0) > 0)
      .map((item) => `${normalized.bellyCounts?.[item]}x ${item}`);
    const request = normalized.bellyCustomizationNote
      ? ` | Request: ${normalized.bellyCustomizationNote}`
      : "";
    parts.push(`🎁 Belly Freebies: ${selected.join(", ") || "Custom selection pending"}${request}`);
  }
  return parts.join(" • ") || null;
};

export interface FreebiesConfig {
  optOut: boolean;
  pigsWithFreebies: number;
  rawInnards: boolean;
  counts: Record<string, number>;
  customizationNote?: string;
  promoCustomized?: boolean;
  promoCounts?: Record<string, number>;
  bellyCounts?: Record<string, number>;
  bellyCustomizationNote?: string;
  bellySignature?: string;
}

export interface BellyFreebieSource {
  kg: number;
  quantity: number;
  label?: string;
}

export const getBellySignature = (items: BellyFreebieSource[]): string =>
  items
    .filter((item) => item.kg >= 2 && item.kg <= 5 && item.quantity > 0)
    .map((item) => `${item.kg}x${Math.floor(item.quantity)}`)
    .sort()
    .join("|");

export const createDefaultBellyCounts = (
  items: BellyFreebieSource[],
): Record<string, number> => {
  const counts = Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0]));
  items.forEach(({ kg, quantity }) => {
    const safeQuantity = Math.max(0, Math.floor(quantity));
    if (kg < 2 || kg > 5 || safeQuantity === 0) return;
    counts.Sarsa += safeQuantity;
    if (kg === 2 || kg === 3) counts.Dinuguan += safeQuantity;
    if (kg === 4) counts.Puto += safeQuantity;
    if (kg === 5) counts.Pancit += safeQuantity;
  });
  return counts;
};

export const getBellyDefaultLabel = (kg: number): string => {
  if (kg === 2 || kg === 3) return "Sarsa + Dinuguan";
  if (kg === 4) return "Sarsa + Puto";
  return "Sarsa + Pancit/Palabok";
};

export interface BellySlotCalculation {
  slotsUsed: number;
  totalSlotsAllowed: number;
  belly5kgCount: number;
  bilaoSelectedCount: number;
  swappableBilaoSlotsForCoke: number;
  cokeSlots: number;
  nonCokeSlots: number;
}

export const calculateBellySlotsUsed = (
  bellyCounts: Record<string, number> = {},
  bellyItems: BellyFreebieSource[] = [],
): BellySlotCalculation => {
  const belly5kgCount = bellyItems
    .filter((item) => item.kg === 5)
    .reduce((sum, item) => sum + Math.max(0, Math.floor(item.quantity)), 0);

  const totalBellyCount = bellyItems.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(item.quantity)),
    0,
  );
  const totalSlotsAllowed = 2 * totalBellyCount;

  const bilaoSelectedCount =
    (bellyCounts.Pancit || 0) +
    (bellyCounts.Palabok || 0) +
    (bellyCounts.Spaghetti || 0);

  const swappableBilaoSlotsForCoke = Math.max(
    0,
    belly5kgCount - bilaoSelectedCount,
  );

  const nonCokeSlots =
    (bellyCounts.Sarsa || 0) +
    (bellyCounts.Pancit || 0) +
    (bellyCounts.Palabok || 0) +
    (bellyCounts.Spaghetti || 0) +
    (bellyCounts.Dinuguan || 0) +
    (bellyCounts.Puto || 0);

  const cokeCount = bellyCounts["1.5L Coke"] || 0;
  let cokeSlots = 0;
  if (swappableBilaoSlotsForCoke > 0 && cokeCount > 0) {
    const maxCokeCovered = 4 * swappableBilaoSlotsForCoke;
    const cokeCovered = Math.min(cokeCount, maxCokeCovered);
    const bilaoSlotsForCoke = Math.ceil(cokeCovered / 4);
    const excessCoke = cokeCount - cokeCovered;
    cokeSlots = bilaoSlotsForCoke + excessCoke;
  } else {
    cokeSlots = cokeCount;
  }

  const slotsUsed = nonCokeSlots + cokeSlots;

  return {
    slotsUsed,
    totalSlotsAllowed,
    belly5kgCount,
    bilaoSelectedCount,
    swappableBilaoSlotsForCoke,
    cokeSlots,
    nonCokeSlots,
  };
};

export const canIncrementBellyFreebie = (
  item: string,
  bellyCounts: Record<string, number> = {},
  bellyItems: BellyFreebieSource[] = [],
): boolean => {
  const nextCounts = {
    ...bellyCounts,
    [item]: (bellyCounts[item] ?? 0) + 1,
  };
  const { slotsUsed, totalSlotsAllowed } = calculateBellySlotsUsed(
    nextCounts,
    bellyItems,
  );
  return slotsUsed <= totalSlotsAllowed;
};

export const createDefaultBellyCokeSwap = (
  items: BellyFreebieSource[],
): Record<string, number> => {
  const counts = Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0]));
  items.forEach(({ kg, quantity }) => {
    const safeQuantity = Math.max(0, Math.floor(quantity));
    if (kg < 2 || kg > 5 || safeQuantity === 0) return;
    counts.Sarsa += safeQuantity;
    if (kg === 5) {
      counts["1.5L Coke"] += 4 * safeQuantity;
    } else {
      if (kg === 2 || kg === 3) counts.Dinuguan += safeQuantity;
      if (kg === 4) counts.Puto += safeQuantity;
    }
  });
  return counts;
};

export const hydrateBellyFreebiesFromOverrides = (
  overrides: Record<string, number> = {},
  bellyItems: BellyFreebieSource[] = [],
  customizationNote: string = "",
): Record<string, number> => {
  if (bellyItems.length === 0) {
    return Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0]));
  }

  const { totalSlotsAllowed } = calculateBellySlotsUsed({}, bellyItems);
  if (totalSlotsAllowed === 0) {
    return Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0]));
  }

  const hasOverrides = Object.keys(overrides).length > 0;
  const hasNoteHint =
    /liver\s*sauce|sarsa|coke|pancit|palabok|spag|puto|dinuguan/i.test(
      customizationNote,
    );
  if (!hasOverrides && !hasNoteHint) {
    return createDefaultBellyCounts(bellyItems);
  }

  const desiredCounts: Record<string, number> = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [
      item,
      Math.max(0, Math.floor(Number(overrides[item]) || 0)),
    ]),
  );

  if (
    desiredCounts.Sarsa === 0 &&
    /liver\s*sauce|sarsa/i.test(customizationNote)
  ) {
    desiredCounts.Sarsa = 1;
  }

  if (desiredCounts.Sarsa === 0 && desiredCounts["1.5L Coke"] > 0) {
    const totalBellyQty = bellyItems.reduce(
      (s, b) => s + Math.max(0, Math.floor(b.quantity)),
      0,
    );
    desiredCounts.Sarsa = totalBellyQty;
  }

  const resultCounts: Record<string, number> = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [item, 0]),
  );

  // Allocate non-coke items first (Sarsa, Bilao, Puto, Dinuguan)
  for (const item of FREEBIE_ITEMS) {
    if (item === "1.5L Coke") continue;
    const target = desiredCounts[item] ?? 0;
    while (
      resultCounts[item] < target &&
      canIncrementBellyFreebie(item, resultCounts, bellyItems)
    ) {
      resultCounts[item]++;
    }
  }

  // Allocate 1.5L Coke (expands up to 4x per unused 5kg Bilao slot)
  const targetCoke = desiredCounts["1.5L Coke"] ?? 0;
  while (
    resultCounts["1.5L Coke"] < targetCoke &&
    canIncrementBellyFreebie("1.5L Coke", resultCounts, bellyItems)
  ) {
    resultCounts["1.5L Coke"]++;
  }

  const { slotsUsed } = calculateBellySlotsUsed(resultCounts, bellyItems);
  if (slotsUsed === 0) {
    return createDefaultBellyCounts(bellyItems);
  }

  return resultCounts;
};

export const sanitizeFreebiesSummary = (
  text?: string | null,
): string | null => {
  if (!text) return null;
  return sanitizeMojibake(text)
    .replace(/Ã°Å¸Å½\s*:?/g, "🎁 ")
    .replace(/ðŸŽ \s*:?/g, "🎁 ")
    .replace(/Ã°Å¸Å¡Â«/g, "🚫")
    .replace(/ðŸš«/g, "🚫")
    .replace(/Ã°Å¸Â¥Â©/g, "🥩")
    .replace(/ðŸ¥©/g, "🥩")
    .replace(/\s+/g, " ")
    .trim();
};

const createCounts = (wholePigCount: number): Record<string, number> => {
  const perItemCount = Math.max(0, Math.floor(wholePigCount));
  return Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [item, perItemCount]),
  );
};

export const createDefaultFreebiesConfig = (
  wholePigCount: number,
  bellyItems: BellyFreebieSource[] = [],
): FreebiesConfig => ({
  optOut: false,
  pigsWithFreebies: Math.max(0, Math.floor(wholePigCount)),
  rawInnards: false,
  counts: createCounts(wholePigCount),
  customizationNote: "",
  bellyCounts: createDefaultBellyCounts(bellyItems),
  bellyCustomizationNote: "",
  bellySignature: getBellySignature(bellyItems),
});

export const getPigsWithFreebies = (
  config: Partial<FreebiesConfig>,
  wholePigCount: number,
): number => {
  const safeWholePigCount = Math.max(0, Math.floor(wholePigCount));
  if (config.optOut) return 0;

  const configuredCount = Number(config.pigsWithFreebies);
  if (!Number.isFinite(configuredCount)) return safeWholePigCount;

  return Math.min(
    safeWholePigCount,
    Math.max(0, Math.floor(configuredCount)),
  );
};

export const getFreebiesAllowedQuota = (
  config: FreebiesConfig,
  wholePigCount: number,
): number => {
  return 7 * getPigsWithFreebies(config, wholePigCount);
};

export const normalizeFreebiesConfig = (
  config: FreebiesConfig,
  wholePigCount: number,
  bellyItems: BellyFreebieSource[] = [],
): FreebiesConfig => {
  const safeWholePigCount = Math.max(0, Math.floor(wholePigCount));
  const pigsWithFreebies = getPigsWithFreebies(config, safeWholePigCount);
  const counts = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [
      item,
      Math.max(0, Math.floor(Number(config.counts?.[item]) || 0)),
    ]),
  );
  const bellySignature = getBellySignature(bellyItems);
  let bellyCounts: Record<string, number>;
  if (config.bellySignature === bellySignature && config.bellyCounts) {
    const rawCounts = Object.fromEntries(
      FREEBIE_ITEMS.map((item) => [
        item,
        Math.max(0, Math.floor(Number(config.bellyCounts?.[item]) || 0)),
      ]),
    );
    const { slotsUsed, totalSlotsAllowed } = calculateBellySlotsUsed(
      rawCounts,
      bellyItems,
    );
    if (slotsUsed <= totalSlotsAllowed) {
      bellyCounts = rawCounts;
    } else {
      bellyCounts = hydrateBellyFreebiesFromOverrides(rawCounts, bellyItems);
    }
  } else {
    bellyCounts = createDefaultBellyCounts(bellyItems);
  }
  const bellyFields = {
    bellyCounts,
    bellyCustomizationNote: config.bellyCustomizationNote?.trim() || "",
    bellySignature,
  };
  const promoFields = {
    promoCustomized: Boolean(config.promoCustomized),
    promoCounts: normalizePromoCounts(config.promoCounts),
  };

  if (pigsWithFreebies === 0 || safeWholePigCount === 0) {
    return {
      optOut: safeWholePigCount > 0 && pigsWithFreebies === 0,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      customizationNote: config.customizationNote?.trim() || "",
      ...promoFields,
      ...bellyFields,
    };
  }

  if (config.rawInnards) {
    counts.Dinuguan = 0;
  }

  return {
    optOut: false,
    pigsWithFreebies,
    rawInnards: Boolean(config.rawInnards),
    counts,
    customizationNote: config.customizationNote?.trim() || "",
    ...promoFields,
    ...bellyFields,
  };
};

export const updatePigsWithFreebies = (
  inputConfig: FreebiesConfig,
  wholePigCount: number,
  requestedPigsWithFreebies: number,
): FreebiesConfig => {
  const safeWholePigCount = Math.max(0, Math.floor(wholePigCount));
  const configuredCurrentCount = Number(inputConfig.pigsWithFreebies);
  const currentPigsWithFreebies = inputConfig.optOut
    ? 0
    : Number.isFinite(configuredCurrentCount)
      ? Math.max(0, Math.floor(configuredCurrentCount))
      : safeWholePigCount;
  const normalized = normalizeFreebiesConfig(inputConfig, safeWholePigCount);
  const pigsWithFreebies = Math.min(
    safeWholePigCount,
    Math.max(0, Math.floor(requestedPigsWithFreebies)),
  );

  if (pigsWithFreebies === 0) {
    return {
      optOut: safeWholePigCount > 0,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      customizationNote: inputConfig.customizationNote?.trim() || "",
      promoCustomized: inputConfig.promoCustomized,
      promoCounts: inputConfig.promoCounts,
      bellyCounts: inputConfig.bellyCounts,
      bellyCustomizationNote: inputConfig.bellyCustomizationNote,
      bellySignature: inputConfig.bellySignature,
    };
  }

  const delta = pigsWithFreebies - currentPigsWithFreebies;
  let remainingQuota = pigsWithFreebies * 7;
  const counts = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => {
      const desired =
        normalized.rawInnards && item === "Dinuguan"
          ? 0
          : Math.max(0, (normalized.counts[item] ?? 0) + delta);
      const quantity = Math.min(desired, remainingQuota);
      remainingQuota -= quantity;
      return [item, quantity];
    }),
  );

  return {
    optOut: false,
    pigsWithFreebies,
    rawInnards: normalized.rawInnards,
    counts,
    customizationNote: inputConfig.customizationNote?.trim() || "",
    promoCustomized: inputConfig.promoCustomized,
    promoCounts: inputConfig.promoCounts,
    bellyCounts: inputConfig.bellyCounts,
    bellyCustomizationNote: inputConfig.bellyCustomizationNote,
    bellySignature: inputConfig.bellySignature,
  };
};

export const parseFreebiesConfig = (
  configJson: string | null | undefined,
  wholePigCount: number,
): FreebiesConfig => {
  if (!configJson) return createDefaultFreebiesConfig(wholePigCount);

  try {
    const parsed = JSON.parse(configJson) as Partial<FreebiesConfig>;
    return normalizeFreebiesConfig(
      {
        optOut: Boolean(parsed.optOut),
        pigsWithFreebies:
          parsed.pigsWithFreebies ??
          (parsed.optOut ? 0 : Math.max(0, Math.floor(wholePigCount))),
        rawInnards: Boolean(parsed.rawInnards),
        counts: parsed.counts ?? {},
        customizationNote: parsed.customizationNote ?? "",
        promoCustomized: Boolean(parsed.promoCustomized),
        promoCounts: parsed.promoCounts ?? {},
        bellyCounts: parsed.bellyCounts ?? {},
        bellyCustomizationNote: parsed.bellyCustomizationNote ?? "",
        bellySignature: parsed.bellySignature ?? "",
      },
      wholePigCount,
    );
  } catch {
    return createDefaultFreebiesConfig(wholePigCount);
  }
};

export const formatFreebiesSummary = (
  inputConfig: FreebiesConfig,
  wholePigCount: number,
  noFreebiesDiscountPerPig = 2000,
  bellyItems: BellyFreebieSource[] = [],
): string | null => {
  if (wholePigCount <= 0 && bellyItems.length === 0) return null;

  const config = normalizeFreebiesConfig(inputConfig, wholePigCount, bellyItems);
  const summaries: string[] = [];
  const pigsWithFreebies = getPigsWithFreebies(config, wholePigCount);
  const pigsWithDiscount = wholePigCount - pigsWithFreebies;

  if (wholePigCount > 0 && pigsWithFreebies === 0) {
    summaries.push("🚫 No Whole Lechon Freebies");
  }

  if (pigsWithFreebies > 0) {
    const quota = 7 * pigsWithFreebies;
    const baseSummary = pigsWithFreebies === wholePigCount
      ? `🎁 ${quota} Whole Lechon Freebies`
      : `🎁 ${quota} Whole Lechon Freebies (${pigsWithFreebies}p)`;
    const isStandard = FREEBIE_ITEMS.every((item) => {
      const expected = item === "Dinuguan" && config.rawInnards ? 0 : pigsWithFreebies;
      return config.counts[item] === expected;
    });

    const details: string[] = [];
    if (isStandard && config.rawInnards) {
      details.push("🥩 Raw Innards / Walang Dinuguan");
    } else if (!isStandard) {
      const selected = FREEBIE_ITEMS.filter((item) => (config.counts[item] ?? 0) > 0)
        .map((item) => `${config.counts[item]}x ${item}`);
      if (selected.length > 0) details.push(selected.join(", "));
      if (config.rawInnards) details.push("🥩 Raw Innards");
    }
    if (config.customizationNote) details.push(`Request: ${config.customizationNote}`);

    let wholeSummary = details.length > 0 ? `${baseSummary}: ${details.join(" | ")}` : baseSummary;
    if (pigsWithDiscount > 0) {
      wholeSummary += ` • 🚫 Less ₱${(pigsWithDiscount * noFreebiesDiscountPerPig).toLocaleString()} (${pigsWithDiscount}p)`;
    }
    summaries.push(wholeSummary);
  }

  if (bellyItems.length > 0) {
    const bellySelection = FREEBIE_ITEMS
      .filter((item) => (config.bellyCounts?.[item] ?? 0) > 0)
      .map((item) => `${config.bellyCounts?.[item]}x ${item}`);
    const note = config.bellyCustomizationNote
      ? ` | Request: ${config.bellyCustomizationNote}`
      : "";
    summaries.push(`🎁 Belly Freebies: ${bellySelection.join(", ") || "Custom selection pending"}${note}`);
  }

  return summaries.join(" • ") || null;
};
