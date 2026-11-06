import { useEffect, useMemo, useState } from "react";
import {
  calculateBellySlotsUsed,
  canIncrementBellyFreebie,
  createDefaultBellyCokeSwap,
  createDefaultBellyCounts,
  createDefaultFreebiesConfig,
  formatFreebiesSummary,
  FREEBIE_ITEMS,
  BellyFreebieSource,
  FreebiesConfig,
  getBellyDefaultLabel,
  getBellySignature,
  getPigsWithFreebies,
  getFreebiesAllowedQuota,
  normalizeFreebiesConfig,
  updatePigsWithFreebies,
} from "@/utils/freebiesHelper";

interface FreebiesSelectorProps {
  wholePigCount: number;
  noFreebiesDiscountPerPig?: number;
  config: FreebiesConfig;
  bellyItems?: BellyFreebieSource[];
  onChange: (config: FreebiesConfig) => void;
}

export default function FreebiesSelector({
  wholePigCount,
  noFreebiesDiscountPerPig = 2000,
  config,
  bellyItems = [],
  onChange,
}: FreebiesSelectorProps) {
  // 1. ALL HOOKS UNCONDITIONALLY AT THE VERY TOP
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBellyExpanded, setIsBellyExpanded] = useState(false);

  const normalized = useMemo(
    () => normalizeFreebiesConfig(config, wholePigCount, bellyItems),
    [config, wholePigCount, bellyItems],
  );

  const defaultBellyCounts = useMemo(
    () => createDefaultBellyCounts(bellyItems),
    [bellyItems],
  );

  const allowedQuota = getFreebiesAllowedQuota(normalized, wholePigCount);
  const currentSum = FREEBIE_ITEMS.reduce(
    (sum, item) => sum + (normalized.counts[item] ?? 0),
    0,
  );
  const pigsWithFreebies = getPigsWithFreebies(normalized, wholePigCount);
  const summary = formatFreebiesSummary(
    normalized,
    wholePigCount,
    noFreebiesDiscountPerPig,
    bellyItems,
  );
  const isCustomized =
    Boolean(normalized.customizationNote) ||
    FREEBIE_ITEMS.some(
      (item) =>
        normalized.counts[item] !==
        (normalized.rawInnards && item === "Dinuguan" ? 0 : pigsWithFreebies),
    );

  const isBellyCustomized = FREEBIE_ITEMS.some(
    (item) =>
      (normalized.bellyCounts?.[item] ?? 0) !== (defaultBellyCounts[item] ?? 0),
  );

  useEffect(() => {
    if (isCustomized) setIsExpanded(true);
  }, [isCustomized]);

  useEffect(() => {
    if (isBellyCustomized) setIsBellyExpanded(true);
  }, [isBellyCustomized]);

  useEffect(() => {
    if (config.bellySignature !== getBellySignature(bellyItems)) {
      onChange(normalized);
    }
  }, [bellyItems, config.bellySignature, normalized, onChange]);

  // 2. EARLY RETURN STRICTLY AFTER ALL HOOKS
  if (wholePigCount <= 0 && bellyItems.length === 0) return null;

  // 3. COMPUTATIONS FOR BELLY SLOTS
  const {
    slotsUsed: bellySlotsUsed,
    totalSlotsAllowed: bellySlotQuota,
    belly5kgCount,
  } = calculateBellySlotsUsed(normalized.bellyCounts ?? {}, bellyItems);

  const bellySummaryText =
    FREEBIE_ITEMS.filter((item) => (normalized.bellyCounts?.[item] ?? 0) > 0)
      .map((item) => `${normalized.bellyCounts?.[item]}x ${item}`)
      .join(", ") || "No items";

  // 4. WHOLE LECHON ACTIONS
  const selectStandard = () => {
    onChange({
      ...createDefaultFreebiesConfig(wholePigCount),
      bellyCounts: normalized.bellyCounts,
      bellyCustomizationNote: normalized.bellyCustomizationNote,
      bellySignature: normalized.bellySignature,
    });
  };

  const selectOptOut = () => {
    onChange({
      optOut: true,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      customizationNote: "",
      bellyCounts: normalized.bellyCounts,
      bellyCustomizationNote: normalized.bellyCustomizationNote,
      bellySignature: normalized.bellySignature,
    });
    setIsExpanded(false);
  };

  const setPigsWithFreebies = (nextCount: number) => {
    const nextConfig = updatePigsWithFreebies(
      normalized,
      wholePigCount,
      nextCount,
    );
    onChange(nextConfig);
    if (nextConfig.optOut) setIsExpanded(false);
  };

  const toggleRawInnards = () => {
    const enabled = !normalized.rawInnards;
    onChange({
      ...normalized,
      rawInnards: enabled,
      counts: {
        ...normalized.counts,
        Dinuguan: enabled ? 0 : pigsWithFreebies,
      },
    });
  };

  const updateCount = (item: string, delta: number) => {
    if (normalized.rawInnards && item === "Dinuguan") return;
    const current = normalized.counts[item] ?? 0;
    const next = Math.max(0, current + delta);
    if (delta > 0 && currentSum >= allowedQuota) return;

    onChange({
      ...normalized,
      counts: { ...normalized.counts, [item]: next },
    });
  };

  // 5. BELLY ACTIONS
  const selectStandardBelly = () => {
    onChange({
      ...normalized,
      bellyCounts: createDefaultBellyCounts(bellyItems),
      bellyCustomizationNote: "",
    });
    setIsBellyExpanded(false);
  };

  const handleSwapBilaoToCoke = () => {
    const nextCounts = createDefaultBellyCokeSwap(bellyItems);
    onChange({
      ...normalized,
      bellyCounts: nextCounts,
      bellyCustomizationNote: "",
    });
  };

  const updateBellyCount = (item: string, delta: number) => {
    const current = normalized.bellyCounts?.[item] ?? 0;
    if (
      delta > 0 &&
      !canIncrementBellyFreebie(item, normalized.bellyCounts ?? {}, bellyItems)
    ) {
      return;
    }
    onChange({
      ...normalized,
      bellyCounts: {
        ...normalized.bellyCounts,
        [item]: Math.max(0, current + delta),
      },
    });
  };

  return (
    <>
      {wholePigCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-amber-950">
              🎁 Whole Lechon Freebies
            </span>
            {summary && (
              <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                {summary}
              </span>
            )}
          </div>

          {wholePigCount === 1 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={selectStandard}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  !normalized.optOut
                    ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                    : "border-stone-300 bg-white text-stone-600"
                }`}
              >
                🎁 Standard 7 Freebies
              </button>
              <button
                type="button"
                onClick={selectOptOut}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  normalized.optOut
                    ? "border-rose-500 bg-rose-100 text-rose-900"
                    : "border-stone-300 bg-white text-stone-600"
                }`}
              >
                🚫 No Freebies (-₱{noFreebiesDiscountPerPig.toLocaleString()})
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2">
              <span className="text-[11px] font-bold text-amber-950">
                Pigs with 7 Freebies:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Remove one pig with freebies"
                  disabled={pigsWithFreebies <= 0}
                  onClick={() => setPigsWithFreebies(pigsWithFreebies - 1)}
                  className="h-7 w-7 rounded-md bg-stone-200 text-sm font-black text-stone-800 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-5 text-center font-mono text-sm font-black text-stone-900">
                  {pigsWithFreebies}
                </span>
                <button
                  type="button"
                  aria-label="Add one pig with freebies"
                  disabled={pigsWithFreebies >= wholePigCount}
                  onClick={() => setPigsWithFreebies(pigsWithFreebies + 1)}
                  className="h-7 w-7 rounded-md bg-stone-900 text-sm font-black text-amber-300 disabled:opacity-40"
                >
                  +
                </button>
                <span className="text-[10px] font-semibold text-stone-600">
                  (Quota: {pigsWithFreebies * 7})
                </span>
              </div>
            </div>
          )}

          {!normalized.optOut && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleRawInnards}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                    normalized.rawInnards
                      ? "border-amber-500 bg-amber-200 text-amber-950"
                      : "border-stone-300 bg-white text-stone-700"
                  }`}
                >
                  🥩 Raw Innards (Walang Dinuguan)
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded((value) => !value)}
                  className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-700"
                >
                  ⚙️ Customize / Swap ({currentSum}/{allowedQuota})
                </button>
              </div>

              {isExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {FREEBIE_ITEMS.map((item) => {
                    const isLocked = normalized.rawInnards && item === "Dinuguan";
                    return (
                      <div
                        key={item}
                        className={`flex items-center justify-between rounded-lg border px-2 py-1.5 ${
                          isLocked
                            ? "border-stone-200 bg-stone-100 opacity-60"
                            : "border-amber-200 bg-white"
                        }`}
                      >
                        <span className="text-[11px] font-medium text-stone-800">
                          {item}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isLocked || (normalized.counts[item] ?? 0) <= 0}
                            onClick={() => updateCount(item, -1)}
                            className="h-6 w-6 rounded bg-stone-200 text-xs font-bold disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs font-bold font-mono">
                            {normalized.counts[item] ?? 0}
                          </span>
                          <button
                            type="button"
                            disabled={isLocked || currentSum >= allowedQuota}
                            onClick={() => updateCount(item, 1)}
                            className="h-6 w-6 rounded bg-stone-900 text-xs font-bold text-amber-300 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {bellyItems.length > 0 && (
        <div className="mt-3 space-y-3 rounded-xl border border-fuchsia-300 bg-fuchsia-50/70 p-3">
          <div>
            <p className="text-xs font-black text-fuchsia-950">🎁 Lechon Belly Freebies</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {bellyItems.map((item, index) => (
                <span
                  key={`${item.kg}-${index}`}
                  className="rounded-full border border-fuchsia-200 bg-white px-2 py-1 text-[10px] font-semibold text-fuchsia-900"
                >
                  {item.quantity}x {item.kg}kg Belly: {getBellyDefaultLabel(item.kg)}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectStandardBelly}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                !isBellyCustomized
                  ? "border-emerald-500 bg-emerald-100 font-bold text-emerald-900 shadow-xs"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>🎁 Standard Belly Freebies</span>
                {!isBellyCustomized && (
                  <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-stone-700">
                Default allocation of 2 freebies per belly
              </p>
            </button>

            <button
              type="button"
              onClick={() => setIsBellyExpanded((prev) => !prev)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                isBellyCustomized
                  ? "border-fuchsia-500 bg-fuchsia-100 font-bold text-fuchsia-950 shadow-xs"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>⚙️ Customize / Swap ({bellySlotsUsed}/{bellySlotQuota})</span>
                {isBellyCustomized && (
                  <span className="rounded-full bg-fuchsia-800 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                    CUSTOM
                  </span>
                )}
              </div>
              <p className="mt-1 text-[10px] text-stone-700">
                {isBellyExpanded ? "Click to collapse" : "Choose items (stays ₱0)"}
              </p>
            </button>
          </div>

          {isBellyExpanded && (
            <div className="space-y-2 pt-1">
              {belly5kgCount > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🥤</span>
                    <span className="text-[11px] font-bold text-purple-950">
                      5kg Belly Special Swap:
                    </span>
                    <span className="text-[10px] text-purple-700">
                      1 Bilao = 4x 1.5L Coke
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwapBilaoToCoke}
                    className="rounded-md border border-purple-400 bg-white px-2.5 py-1 text-[11px] font-bold text-purple-900 shadow-xs hover:bg-purple-100 transition-colors"
                  >
                    🥤 Swap Bilao → 4x 1.5L Coke
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {FREEBIE_ITEMS.map((item) => {
                  const isPlusDisabled = !canIncrementBellyFreebie(
                    item,
                    normalized.bellyCounts ?? {},
                    bellyItems,
                  );
                  return (
                    <div
                      key={`belly-${item}`}
                      className="flex items-center justify-between rounded-lg border border-fuchsia-200 bg-white px-2 py-1.5"
                    >
                      <span className="text-[11px] font-medium text-stone-800">
                        {item}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={(normalized.bellyCounts?.[item] ?? 0) <= 0}
                          onClick={() => updateBellyCount(item, -1)}
                          className="h-6 w-6 rounded bg-stone-200 text-xs font-bold disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-5 text-center font-mono text-xs font-bold">
                          {normalized.bellyCounts?.[item] ?? 0}
                        </span>
                        <button
                          type="button"
                          disabled={isPlusDisabled}
                          onClick={() => updateBellyCount(item, 1)}
                          className="h-6 w-6 rounded bg-fuchsia-900 text-xs font-bold text-white disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mt-1 text-[10px] font-semibold text-fuchsia-800">
            Slots Used: {bellySlotsUsed}/{bellySlotQuota} ({bellySummaryText}) • 2 slots per belly (5kg Bilao = 4x Coke) • custom swaps stay ₱0
          </p>
        </div>
      )}
    </>
  );
}
