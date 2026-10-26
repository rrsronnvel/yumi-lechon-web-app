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

export interface FreebiesConfig {
  optOut: boolean;
  pigsWithFreebies: number;
  rawInnards: boolean;
  counts: Record<string, number>;
}

export const sanitizeFreebiesSummary = (
  text?: string | null,
): string | null => {
  if (!text) return null;
  return text
    .replace(/Ã°Å¸Å½\s*:?/g, "🎁 ")
    .replace(/ðŸŽ\s*:?/g, "🎁 ")
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
): FreebiesConfig => ({
  optOut: false,
  pigsWithFreebies: Math.max(0, Math.floor(wholePigCount)),
  rawInnards: false,
  counts: createCounts(wholePigCount),
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
): FreebiesConfig => {
  const safeWholePigCount = Math.max(0, Math.floor(wholePigCount));
  const pigsWithFreebies = getPigsWithFreebies(config, safeWholePigCount);
  const counts = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [
      item,
      Math.max(0, Math.floor(Number(config.counts?.[item]) || 0)),
    ]),
  );

  if (pigsWithFreebies === 0 || safeWholePigCount === 0) {
    return {
      optOut: safeWholePigCount > 0 && pigsWithFreebies === 0,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
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
): string | null => {
  if (wholePigCount <= 0) return null;

  const config = normalizeFreebiesConfig(inputConfig, wholePigCount);
  const pigsWithFreebies = getPigsWithFreebies(config, wholePigCount);
  const pigsWithDiscount = wholePigCount - pigsWithFreebies;

  if (pigsWithFreebies === 0) return "🚫 No Freebies";

  const quota = 7 * pigsWithFreebies;
  const baseSummary =
    pigsWithFreebies === wholePigCount
      ? `🎁 ${quota} Freebies`
      : `🎁 ${quota} Freebies (${pigsWithFreebies}p)`;
  const isStandard = FREEBIE_ITEMS.every((item) => {
    const expected =
      item === "Dinuguan" && config.rawInnards ? 0 : pigsWithFreebies;
    return config.counts[item] === expected;
  });

  const details: string[] = [];
  if (isStandard && config.rawInnards) {
    details.push("🥩 Raw Innards / Walang Dinuguan");
  } else if (!isStandard) {
    const modifiedPositive = FREEBIE_ITEMS.filter((item) => {
      const expected =
        item === "Dinuguan" && config.rawInnards ? 0 : pigsWithFreebies;
      const quantity = config.counts[item] ?? 0;
      return quantity > 0 && quantity !== expected;
    }).map((item) => `${config.counts[item]} ${item}`);
    const omitted = FREEBIE_ITEMS.filter(
      (item) =>
        (config.counts[item] ?? 0) === 0 &&
        !(config.rawInnards && item === "Dinuguan"),
    );

    if (modifiedPositive.length > 0) {
      details.push(modifiedPositive.join(", "));
    }
    if (omitted.length > 0) details.push(`No ${omitted.join(", ")}`);
    if (config.rawInnards) details.push("🥩 Raw Innards");
  }

  const customizedSummary =
    details.length > 0 ? `${baseSummary}: ${details.join(" | ")}` : baseSummary;

  return pigsWithDiscount > 0
    ? `${customizedSummary} • 🚫 Less ₱${(
        pigsWithDiscount * noFreebiesDiscountPerPig
      ).toLocaleString()} (${pigsWithDiscount}p)`
    : customizedSummary;
};
