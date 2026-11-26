export const FREEBIE_ITEMS = [
  "Sarsa",
  "1.5L Coke",
  "Pancit",
  "Palabok",
  "Spaghetti",
  "Dinuguan",
  "Puto",
] as const;

export const PROMO_KITCHEN_ITEMS = [
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

export type PromoKitchenItem = (typeof PROMO_KITCHEN_ITEMS)[number];

export type FreebieItem = (typeof FREEBIE_ITEMS)[number];

export interface FreebiesConfig {
  optOut: boolean;
  pigsWithFreebies: number;
  rawInnards: boolean;
  counts: Record<string, number>;
  customizationNote?: string;
  bellyCounts?: Record<string, number>;
  bellyCustomizationNote?: string;
  bellySignature?: string;
  /** Explicit December/peak allocation. Backend prep gives this precedence over the preset. */
  promoCustomized?: boolean;
  promoCounts?: Record<string, number>;
}

export const normalizePromoKitchenCounts = (
  counts: Record<string, number> = {},
): Record<string, number> => Object.fromEntries(
  PROMO_KITCHEN_ITEMS.map((item) => [
    item,
    Math.max(0, Math.floor(Number(counts[item]) || 0)),
  ]),
);

export const createPromoPackageCounts = (
  includedItems: Record<string, number> = {},
  wholePigCount = 0,
): Record<string, number> => {
  const multiplier = Math.max(0, Math.floor(wholePigCount));
  return normalizePromoKitchenCounts(Object.fromEntries(
    PROMO_KITCHEN_ITEMS.map((item) => [
      item,
      Math.max(0, Number(includedItems[item]) || 0) * multiplier,
    ]),
  ));
};

export const getPromoSlotsUsed = (
  counts: Record<string, number> = {},
  rawInnardsCount = 0,
): number => Object.values(normalizePromoKitchenCounts(counts))
  .reduce((sum, quantity) => sum + quantity, Math.max(0, Math.floor(rawInnardsCount)));

export const arePromoCountsEqual = (
  left: Record<string, number> = {},
  right: Record<string, number> = {},
): boolean => {
  const normalizedLeft = normalizePromoKitchenCounts(left);
  const normalizedRight = normalizePromoKitchenCounts(right);
  return PROMO_KITCHEN_ITEMS.every(
    (item) => normalizedLeft[item] === normalizedRight[item],
  );
};

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
  return text
    .replace(/Ã°Å¸Å½\s*:?/g, "🎁 ")
    .replace(/ðŸŽ \s*:?/g, "🎁 ")
    .replace(/Ã°Å¸Å¡Â«/g, "🚫")
    .replace(/ðŸš«/g, "🚫")
    .replace(/Ã°Å¸Â¥Â©/g, "🥩")
    .replace(/ðŸ¥©/g, "🥩")
    .replace(/\s+/g, " ")
    .trim();
};

interface ManifestPromoInput {
  summary?: string | null;
  promoCode?: string | null;
  promoLabel?: string | null;
  configJson?: string | null;
  includedItems?: Record<string, number>;
  wholePigCount: number;
}

const formatPromoItems = (counts: Record<string, number>): string[] =>
  PROMO_KITCHEN_ITEMS.flatMap((item) => {
    const quantity = Math.floor(Number(counts[item]));
    return Number.isFinite(quantity) && quantity > 0 ? [`${quantity}x ${item}`] : [];
  });

export function formatManifestFreebiesSummary({
  summary, promoCode, promoLabel, configJson, includedItems, wholePigCount,
}: ManifestPromoInput): string | null {
  const legacySummary = sanitizeFreebiesSummary(summary);
  if (!promoCode) return legacySummary;

  const config = parseFreebiesConfig(configJson, wholePigCount);
  const recordedCounts = config.promoCounts ?? (config.promoCustomized ? config.counts : undefined);
  const counts = recordedCounts ?? createPromoPackageCounts(includedItems, wholePigCount);
  const items = formatPromoItems({ ...counts, ...(config.rawInnards ? { Dinuguan: 0 } : {}) });
  if (!items.length && !config.promoCustomized) return legacySummary ?? promoLabel ?? null;

  const details = [items.join(', ') || 'No included dishes'];
  if (config.rawInnards) details.push('🥩 Raw Innards');
  if (config.customizationNote) details.push(`Request: ${config.customizationNote}`);
  const bellySummary = legacySummary?.split(' • ').find((part) => /Belly Freebies/i.test(part));
  const heading = promoLabel || 'Promo Freebies';
  return [`🎁 ${heading}: ${details.join(' | ')}`, bellySummary].filter(Boolean).join(' • ');
}

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
    promoCounts: config.promoCounts
      ? normalizePromoKitchenCounts(config.promoCounts)
      : undefined,
  };

  if (pigsWithFreebies === 0 || safeWholePigCount === 0) {
    return {
      optOut: safeWholePigCount > 0 && pigsWithFreebies === 0,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      customizationNote: config.customizationNote?.trim() || "",
      ...bellyFields,
      ...promoFields,
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
    ...bellyFields,
    ...promoFields,
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
      bellyCounts: inputConfig.bellyCounts,
      bellyCustomizationNote: inputConfig.bellyCustomizationNote,
      bellySignature: inputConfig.bellySignature,
      promoCustomized: inputConfig.promoCustomized,
      promoCounts: inputConfig.promoCounts,
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
    bellyCounts: inputConfig.bellyCounts,
    bellyCustomizationNote: inputConfig.bellyCustomizationNote,
    bellySignature: inputConfig.bellySignature,
    promoCustomized: inputConfig.promoCustomized,
    promoCounts: inputConfig.promoCounts,
  };
};

export const applyPromoToFreebiesConfig = (
  inputConfig: FreebiesConfig,
  wholePigCount: number,
  includedItems: Record<string, number>,
  discountAmount: number,
  bellyItems: BellyFreebieSource[] = [],
): FreebiesConfig => {
  const normalized = normalizeFreebiesConfig(inputConfig, wholePigCount, bellyItems);
  if (Number(discountAmount) > 0) {
    return {
      ...updatePigsWithFreebies(normalized, wholePigCount, 0),
      promoCustomized: false,
      promoCounts: undefined,
    };
  }

  const multiplier = Math.max(0, Math.floor(wholePigCount));
  const promoCounts = createPromoPackageCounts(includedItems, multiplier);
  const counts = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [
      item,
      normalized.rawInnards && item === "Dinuguan"
        ? 0
        : promoCounts[item] ?? 0,
    ]),
  );
  if (normalized.rawInnards) promoCounts.Dinuguan = 0;

  return {
    ...normalized,
    optOut: false,
    pigsWithFreebies: multiplier,
    counts,
    customizationNote: "",
    promoCustomized: false,
    promoCounts,
  };
};

export const applyPromoCustomCounts = (
  inputConfig: FreebiesConfig,
  wholePigCount: number,
  requestedCounts: Record<string, number>,
  defaultCounts: Record<string, number>,
  bellyItems: BellyFreebieSource[] = [],
): FreebiesConfig => {
  const normalized = normalizeFreebiesConfig(inputConfig, wholePigCount, bellyItems);
  const promoCounts = normalizePromoKitchenCounts(requestedCounts);
  if (normalized.rawInnards) promoCounts.Dinuguan = 0;
  const comparableDefaults = normalizePromoKitchenCounts(defaultCounts);
  if (normalized.rawInnards) comparableDefaults.Dinuguan = 0;
  const promoCustomized = !arePromoCountsEqual(promoCounts, comparableDefaults);
  const counts = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [item, promoCounts[item] ?? 0]),
  );

  return {
    ...normalized,
    optOut: false,
    pigsWithFreebies: Math.max(0, Math.floor(wholePigCount)),
    counts,
    customizationNote: promoCustomized ? "Promo package custom swap" : "",
    promoCustomized,
    promoCounts,
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
        bellyCounts: parsed.bellyCounts ?? {},
        bellyCustomizationNote: parsed.bellyCustomizationNote ?? "",
        bellySignature: parsed.bellySignature ?? "",
        promoCustomized: Boolean(parsed.promoCustomized),
        promoCounts: parsed.promoCounts ?? undefined,
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
    if (config.promoCounts) {
      const selected = formatPromoItems({
        ...config.promoCounts,
        ...(config.rawInnards ? { Dinuguan: 0 } : {}),
      });
      if (selected.length > 0) details.push(selected.join(", "));
      if (config.rawInnards) details.push("🥩 Raw Innards");
    } else if (isStandard && config.rawInnards) {
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
