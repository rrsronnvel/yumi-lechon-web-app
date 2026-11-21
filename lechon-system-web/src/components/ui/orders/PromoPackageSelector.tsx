import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { usePromosForDate, type PromoPackage } from "@/hooks/usePromos";
import {
  formatPromoIncludedItems,
  createPromoPackageCounts,
  getPromoSlotsUsed,
  getPromoDateKind,
  parsePromoIncludedItems,
  PROMO_FREEBIE_ITEMS,
} from "@/utils/freebiesHelper";

interface PromoPackageSelectorProps {
  targetDeliveryTime?: string | null;
  wholePigCount: number;
  value?: string | null;
  autoSelectDefault?: boolean;
  onChange: (promo: PromoPackage) => void;
  onResolved?: (promo: PromoPackage | null) => void;
  promoCustomized?: boolean;
  promoCounts?: Record<string, number>;
  onCustomizationChange?: (
    customized: boolean,
    counts: Record<string, number>,
  ) => void;
}

export default function PromoPackageSelector({
  targetDeliveryTime,
  wholePigCount,
  value,
  autoSelectDefault = true,
  onChange,
  onResolved,
  promoCustomized = false,
  promoCounts = {},
  onCustomizationChange,
}: PromoPackageSelectorProps) {
  const [isCustomizerExpanded, setIsCustomizerExpanded] = useState(false);
  const previousQtyRef = useRef(wholePigCount);
  const previousCodeRef = useRef<string | null>(null);
  const date = targetDeliveryTime?.slice(0, 10) || "";
  const dateKind = getPromoDateKind(date);
  const { data: promos = [], isLoading } = usePromosForDate(date);
  const selected = promos.find((promo) => promo.code === value) ?? null;

  const grouped = useMemo(() => {
    const map = new Map<string, PromoPackage[]>();
    promos.forEach((promo) => {
      const list = map.get(promo.groupName) ?? [];
      list.push(promo);
      map.set(promo.groupName, list);
    });
    return Array.from(map.entries());
  }, [promos]);

  useEffect(() => {
    if (!autoSelectDefault || wholePigCount <= 0 || selected || promos.length === 0) return;
    onChange(promos[0]);
  }, [autoSelectDefault, onChange, promos, selected, wholePigCount]);

  useEffect(() => {
    onResolved?.(selected);
  }, [onResolved, selected]);

  useEffect(() => {
    if (previousCodeRef.current !== selected?.code) {
      previousCodeRef.current = selected?.code ?? null;
      previousQtyRef.current = wholePigCount;
      setIsCustomizerExpanded(false);
      return;
    }
    const previousQty = previousQtyRef.current;
    previousQtyRef.current = wholePigCount;
    if (!promoCustomized || !selected || previousQty <= 0 || previousQty === wholePigCount) return;
    const scaled = Object.fromEntries(
      PROMO_FREEBIE_ITEMS.map((item) => [
        item,
        Math.max(0, Math.round(((promoCounts[item] ?? 0) / previousQty) * wholePigCount)),
      ]),
    );
    onCustomizationChange?.(true, scaled);
  }, [onCustomizationChange, promoCounts, promoCustomized, selected, wholePigCount]);

  if (wholePigCount <= 0 || dateKind === "regular") return null;

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 ${dateKind === "decemberPeak" ? "border-amber-400 bg-amber-100/70" : "border-emerald-300 bg-emerald-50/70"}`}>
      <div>
        <p className="text-xs font-black text-stone-950">
          {dateKind === "decemberPeak"
            ? "🎄 Peak Holiday Freebies (Dec 24 & 31)"
            : "🎄 Selected December Promo"}
        </p>
        <p className="mt-0.5 text-[10px] text-stone-600">
          Package quantities are multiplied by {wholePigCount} Whole Lechon{wholePigCount === 1 ? "" : "s"}.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border bg-white p-2 text-xs text-stone-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading promo packages…
        </div>
      ) : (
        <select
          className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={selected?.code ?? ""}
          onChange={(event) => {
            const promo = promos.find((candidate) => candidate.code === event.target.value);
            if (promo) onChange(promo);
          }}
        >
          <option value="">Select a promo package…</option>
          {grouped.map(([group, options]) => (
            <optgroup key={group} label={group.toUpperCase()}>
              {options.map((promo) => (
                <option key={promo.code} value={promo.code}>
                  {promo.name}{promo.discountAmount > 0 ? ` (-₱${promo.discountAmount.toLocaleString()})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      {selected && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
          {selected.discountAmount > 0 ? (
            <span className="rounded-full border border-rose-300 bg-white px-2 py-1 text-[10px] font-bold text-rose-800">
              1x Liver Sauce Only + ₱{selected.discountAmount.toLocaleString()} Discount / Whole Lechon
            </span>
          ) : (
            formatPromoIncludedItems(parsePromoIncludedItems(selected.includedItemsJson)).map((label) => (
              <span key={label} className="rounded-full border border-emerald-300 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-900">
                {label}
              </span>
            ))
          )}
          </div>

          {selected.discountAmount === 0 && getPromoSlotsUsed(parsePromoIncludedItems(selected.includedItemsJson)) > 1 && (
            <div className="space-y-2 border-t border-stone-200 pt-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomizerExpanded(false);
                    onCustomizationChange?.(
                      false,
                      createPromoPackageCounts(
                        parsePromoIncludedItems(selected.includedItemsJson),
                        wholePigCount,
                      ),
                    );
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    !promoCustomized
                      ? "border-emerald-500 bg-emerald-100 font-bold text-emerald-900"
                      : "border-stone-200 bg-white text-stone-700"
                  }`}
                >
                  🎁 Standard Package Items
                  {!promoCustomized && <span className="ml-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] text-white">ACTIVE</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!promoCustomized) {
                      onCustomizationChange?.(
                        true,
                        createPromoPackageCounts(
                          parsePromoIncludedItems(selected.includedItemsJson),
                          wholePigCount,
                        ),
                      );
                    }
                    setIsCustomizerExpanded((current) => !current || !promoCustomized);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    promoCustomized
                      ? "border-violet-500 bg-violet-100 font-bold text-violet-950"
                      : "border-stone-200 bg-white text-stone-700"
                  }`}
                >
                  ⚙️ Customize / Swap ({getPromoSlotsUsed(promoCustomized ? promoCounts : createPromoPackageCounts(parsePromoIncludedItems(selected.includedItemsJson), wholePigCount))}/{getPromoSlotsUsed(createPromoPackageCounts(parsePromoIncludedItems(selected.includedItemsJson), wholePigCount))})
                </button>
              </div>

              {promoCustomized && isCustomizerExpanded && (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {PROMO_FREEBIE_ITEMS.map((item) => {
                    const usedSlots = getPromoSlotsUsed(promoCounts);
                    const allowedSlots = getPromoSlotsUsed(
                      createPromoPackageCounts(
                        parsePromoIncludedItems(selected.includedItemsJson),
                        wholePigCount,
                      ),
                    );
                    const quantity = promoCounts[item] ?? 0;
                    return (
                      <div key={item} className="flex items-center justify-between rounded-lg border border-violet-200 bg-white px-2 py-1.5">
                        <span className="text-[11px] font-medium text-stone-800">{item}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={quantity <= 0} onClick={() => onCustomizationChange?.(true, { ...promoCounts, [item]: Math.max(0, quantity - 1) })} className="h-6 w-6 rounded bg-stone-200 text-xs font-bold disabled:opacity-40">−</button>
                          <span className="w-5 text-center font-mono text-xs font-bold">{quantity}</span>
                          <button type="button" disabled={usedSlots >= allowedSlots} onClick={() => onCustomizationChange?.(true, { ...promoCounts, [item]: quantity + 1 })} className="h-6 w-6 rounded bg-violet-900 text-xs font-bold text-white disabled:opacity-40">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {promoCustomized && (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-violet-900">
                  <span>Slots Used: {getPromoSlotsUsed(promoCounts)}/{getPromoSlotsUsed(createPromoPackageCounts(parsePromoIncludedItems(selected.includedItemsJson), wholePigCount))}</span>
                  {PROMO_FREEBIE_ITEMS.filter((item) => (promoCounts[item] ?? 0) > 0).map((item) => (
                    <span key={item} className="rounded-full border border-violet-200 bg-white px-2 py-0.5">{promoCounts[item]}x {item}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
