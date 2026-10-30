import { useEffect, useMemo, useState } from "react";
import {
  createDefaultFreebiesConfig,
  formatFreebiesSummary,
  FREEBIE_ITEMS,
  FreebiesConfig,
  getPigsWithFreebies,
  getFreebiesAllowedQuota,
  normalizeFreebiesConfig,
  updatePigsWithFreebies,
} from "@/utils/freebiesHelper";

interface FreebiesSelectorProps {
  wholePigCount: number;
  noFreebiesDiscountPerPig?: number;
  config: FreebiesConfig;
  onChange: (config: FreebiesConfig) => void;
}

export default function FreebiesSelector({
  wholePigCount,
  noFreebiesDiscountPerPig = 2000,
  config,
  onChange,
}: FreebiesSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalized = useMemo(
    () => normalizeFreebiesConfig(config, wholePigCount),
    [config, wholePigCount],
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
  );
  const isCustomized = Boolean(normalized.customizationNote) || FREEBIE_ITEMS.some(
    (item) => normalized.counts[item] !== (normalized.rawInnards && item === "Dinuguan" ? 0 : pigsWithFreebies),
  );

  useEffect(() => {
    if (isCustomized) setIsExpanded(true);
  }, [isCustomized]);

  if (wholePigCount <= 0) return null;

  const selectStandard = () => {
    onChange(createDefaultFreebiesConfig(wholePigCount));
  };

  const selectOptOut = () => {
    onChange({
      optOut: true,
      pigsWithFreebies: 0,
      rawInnards: false,
      counts: Object.fromEntries(FREEBIE_ITEMS.map((item) => [item, 0])),
      customizationNote: "",
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

  return (
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
  );
}
