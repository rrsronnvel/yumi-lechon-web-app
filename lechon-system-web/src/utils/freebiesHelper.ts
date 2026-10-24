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
  rawInnards: boolean;
  counts: Record<string, number>;
}

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
  rawInnards: false,
  counts: createCounts(wholePigCount),
});

export const getFreebiesAllowedQuota = (
  config: FreebiesConfig,
  wholePigCount: number,
): number => {
  if (wholePigCount <= 0 || config.optOut) return 0;
  return (config.rawInnards ? 6 : 7) * wholePigCount;
};

export const normalizeFreebiesConfig = (
  config: FreebiesConfig,
  wholePigCount: number,
): FreebiesConfig => {
  const safeWholePigCount = Math.max(0, Math.floor(wholePigCount));
  const counts = Object.fromEntries(
    FREEBIE_ITEMS.map((item) => [
      item,
      Math.max(0, Math.floor(Number(config.counts?.[item]) || 0)),
    ]),
  );

  if (config.optOut || safeWholePigCount === 0) {
    return {
      optOut: config.optOut,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
    };
  }

  if (config.rawInnards) {
    counts.Dinuguan = 0;
  }

  return {
    optOut: false,
    rawInnards: Boolean(config.rawInnards),
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
): string | null => {
  if (wholePigCount <= 0) return null;

  const config = normalizeFreebiesConfig(inputConfig, wholePigCount);
  const totalQuota = 7 * wholePigCount;

  if (config.optOut) return "🚫 No Freebies";

  const isStandard = FREEBIE_ITEMS.every((item) => {
    const expected =
      item === "Dinuguan" && config.rawInnards ? 0 : wholePigCount;
    return config.counts[item] === expected;
  });

  if (isStandard && !config.rawInnards) {
    return `🎁 ${totalQuota} Freebies`;
  }

  if (isStandard && config.rawInnards) {
    return `🎁 ${totalQuota} Freebies (🥩 Raw Innards / Walang Dinuguan)`;
  }

  const modifiedPositive = FREEBIE_ITEMS.filter((item) => {
    const expected =
      item === "Dinuguan" && config.rawInnards ? 0 : wholePigCount;
    const quantity = config.counts[item] ?? 0;
    return quantity > 0 && quantity !== expected;
  }).map((item) => `${config.counts[item]} ${item}`);

  const omitted = FREEBIE_ITEMS.filter(
    (item) =>
      (config.counts[item] ?? 0) === 0 &&
      !(config.rawInnards && item === "Dinuguan"),
  );

  const details: string[] = [];
  if (modifiedPositive.length > 0) details.push(modifiedPositive.join(", "));
  if (omitted.length > 0) details.push(`No ${omitted.join(", ")}`);
  if (config.rawInnards) details.push("🥩 Raw Innards");

  return details.length > 0
    ? `🎁 ${totalQuota} Freebies: ${details.join(" | ")}`
    : `🎁 ${totalQuota} Freebies`;
};

