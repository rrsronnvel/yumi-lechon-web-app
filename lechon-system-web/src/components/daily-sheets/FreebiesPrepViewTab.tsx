import { useState } from "react";
import { toast } from "sonner";
import {
  Soup,
  UtensilsCrossed,
  Trash2,
  PlusCircle,
} from "lucide-react";
import { sanitizeMojibake } from "@/utils/sanitizeDisplayText";
import { WalkInBadge } from "@/components/WalkInBadge";
import {
  useFreebiesPrep,
  useDeletePrepRequestMutation,
  FreebiePrepRosterRowDto,
  PackItemPillDto,
} from "@/hooks/useFreebiesPrep";
import { Button } from "@/components/ui/button";

export interface FreebiesPrepViewTabProps {
  mode?: "edit" | "clean";
  selectedDate?: string;
  canEdit?: boolean;
  onAddStorePaluto?: () => void;
}

export function FreebiesPrepViewTab({
  mode = "edit",
  selectedDate,
  onAddStorePaluto,
}: FreebiesPrepViewTabProps) {
  const { data, isLoading, isError } = useFreebiesPrep(selectedDate);
  const deleteMutation = useDeletePrepRequestMutation();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isClean = mode === "clean";

  if (isLoading) {
    return (
      <div className="p-8 text-center text-stone-500 font-medium">
        Loading freebies & kitchen prep roster…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        Failed to load freebies & prep schedule.
      </div>
    );
  }

  const { summary, roster = [] } = data;

  const handleDeletePaluto = async (id: number) => {
    if (isClean || deleteMutation.isPending) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this Store Paluto / Kitchen Prep request?"
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Store Paluto request deleted.");
    } catch (err) {
      toast.error("Failed to delete Store Paluto request.", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Split into confirmed and time-TBD rows
  const scheduledRows = roster.filter((r) => !r.isTimeTbd);
  const timeTbdRows = roster.filter((r) => !!r.isTimeTbd);

  // Helper for pill rendering
  const renderPill = (pill: PackItemPillDto, idx: number) => {
    if (pill.badgeType === "NoFreebies" || pill.label.includes("NO FREEBIES")) {
      return (
        <span
          key={idx}
          className={
            isClean
              ? "inline-flex items-center px-1.5 py-0.5 border border-black bg-slate-100 text-[10px] font-black text-black uppercase"
              : "inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-900 shadow-xs"
          }
        >
          {pill.label}
        </span>
      );
    }

    if (
      pill.badgeType === "Special" &&
      (pill.label.includes("Raw Innards") || pill.label.includes("Hilaw"))
    ) {
      return (
        <span
          key={idx}
          className={
            isClean
              ? "inline-flex items-center px-1.5 py-0.5 border-2 border-black bg-slate-200 text-[10px] font-black text-black"
              : "inline-flex items-center gap-1 rounded border border-purple-400 bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-950 shadow-xs"
          }
        >
          {pill.label}
        </span>
      );
    }

    if (pill.badgeType === "Special" && pill.label.includes("Bilao Swapped")) {
      return (
        <span
          key={idx}
          className={
            isClean
              ? "inline-flex items-center px-1.5 py-0.5 border border-black bg-white text-[10px] font-black text-black"
              : "inline-flex items-center gap-1 rounded border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-950"
          }
        >
          {pill.label}
        </span>
      );
    }

    if (pill.badgeType === "PaidAddOn") {
      return (
        <span
          key={idx}
          className={
            isClean
              ? "inline-flex items-center px-1.5 py-0.5 border border-black bg-slate-100 text-[10px] font-black text-black"
              : "inline-flex items-center gap-1 rounded border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-950"
          }
        >
          {pill.label}
        </span>
      );
    }

    if (pill.badgeType === "Paluto") {
      return (
        <span
          key={idx}
          className={
            isClean
              ? "inline-flex items-center px-1.5 py-0.5 border border-black bg-white text-[10px] font-bold text-black"
              : "inline-flex items-center gap-1 rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-900"
          }
        >
          {pill.label}
        </span>
      );
    }

    // Standard Freebie
    return (
      <span
        key={idx}
        className={
          isClean
            ? "inline-flex items-center px-1.5 py-0.5 border border-slate-400 bg-white text-[10px] font-bold text-black"
            : "inline-flex items-center gap-1 rounded border border-stone-300 bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-900"
        }
      >
        {pill.label}
      </span>
    );
  };

  const renderRosterRow = (row: FreebiePrepRosterRowDto) => {
    const isPaluto = row.isPrepRequest;
    const sanitizedRemarks = sanitizeMojibake(row.remarks);

    return (
      <tr
        key={row.id}
        className={`${
          isPaluto
            ? isClean
              ? "bg-slate-50 border-l-4 border-l-black"
              : "bg-indigo-50/40 hover:bg-indigo-50/70 border-l-4 border-l-indigo-500"
            : row.isTimeTbd
            ? "bg-amber-50/40 border-l-4 border-l-amber-400"
            : "even:bg-slate-50 odd:bg-white hover:bg-amber-50/30"
        } text-slate-900`}
      >
        {/* 1. TIME NEEDED */}
        <td className="px-2 py-2 text-center border-r border-slate-300 text-xs font-mono font-bold whitespace-nowrap">
          {row.isTimeTbd ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10.5px]">
              ⏳ TIME TBD
            </span>
          ) : (
            <span className={isPaluto ? "text-indigo-950 font-black" : "text-slate-900 font-bold"}>
              {row.timeNeededDisplay}
            </span>
          )}
        </td>

        {/* 2. ORDER / RECIPIENT */}
        <td className="px-2.5 py-2 border-r border-slate-300 text-xs">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-slate-900">
                {row.orderRef}
              </span>
              <WalkInBadge
                source={row.fulfillmentType}
                customerName={row.customerName ?? row.recipient}
                facebookName={row.facebookName}
                clean={isClean}
              />
            </div>
            <span className="font-semibold text-stone-800 line-clamp-1">
              {row.recipient}
            </span>
          </div>
        </td>

        {/* 3. TYPE / ITEM */}
        <td className="px-2 py-2 border-r border-slate-300 text-xs">
          {isPaluto ? (
            <span
              className={
                isClean
                  ? "inline-block font-black text-black text-[11px] uppercase"
                  : row.category === "Staff Meryenda"
                  ? "inline-block bg-purple-100 text-purple-900 border border-purple-300 font-bold px-2 py-0.5 rounded text-xs leading-none"
                  : row.category === "Owner / Family"
                  ? "inline-block bg-amber-100 text-amber-950 border border-amber-400 font-bold px-2 py-0.5 rounded text-xs leading-none"
                  : row.category === "VIP Gift"
                  ? "inline-block bg-emerald-100 text-emerald-950 border border-emerald-400 font-bold px-2 py-0.5 rounded text-xs leading-none"
                  : "inline-block bg-blue-100 text-blue-950 border border-blue-400 font-bold px-2 py-0.5 rounded text-xs leading-none"
              }
            >
              {row.typeItem}
            </span>
          ) : (
            <span className="font-bold text-slate-800 text-xs">{row.typeItem}</span>
          )}
        </td>

        {/* 4. FULFILLMENT / ROUTE */}
        <td className="px-2 py-2 border-r border-slate-300 text-xs">
          {isPaluto ? (
            <span className="bg-stone-100 text-stone-900 border border-stone-300 px-1.5 py-0.5 rounded text-[10.5px] font-bold whitespace-nowrap inline-flex items-center justify-center leading-none">
              🏠 Internal Kitchen
            </span>
          ) : row.fulfillmentType === "Pickup" ? (
            <span className="bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[10.5px] font-bold whitespace-nowrap inline-flex items-center justify-center leading-none">
              🏪 Store Pickup
            </span>
          ) : row.fulfillmentType === "Lalamove" ? (
            <span className="bg-orange-50 text-orange-800 border border-orange-300 px-1.5 py-0.5 rounded text-[10.5px] font-bold whitespace-nowrap inline-flex items-center justify-center leading-none">
              📦 Lalamove
            </span>
          ) : (
            <span
              className={
                row.riderName && row.riderName !== "Unassigned"
                  ? "text-blue-700 font-bold"
                  : "text-slate-400 italic font-normal"
              }
            >
              {row.routeDisplay || `🛵 ${row.riderName || "Unassigned"}`}
            </span>
          )}
        </td>

        {/* 5. FREEBIES & SIDES TO PACK (CHECKLIST) */}
        <td className="px-2.5 py-2 border-r border-slate-300 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {row.checklistPills && row.checklistPills.length > 0 ? (
              row.checklistPills.map(renderPill)
            ) : (
              <span className="text-slate-400 italic text-[11px]">No sides to pack</span>
            )}
          </div>
        </td>

        {/* 6. REMARKS / SPECIAL REQUESTS */}
        <td className="px-2 py-2 text-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-700 font-medium">
              {sanitizedRemarks || "-"}
            </span>
            {isPaluto && !isClean && (
              <button
                type="button"
                onClick={() => handleDeletePaluto(row.prepRequestId!)}
                disabled={deletingId === row.prepRequestId}
                title="Delete Store Paluto Request"
                className="shrink-0 rounded p-1 text-stone-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4 w-full">
      {/* SECTION 1: MORNING AGGREGATE PREP BOARD */}
      <div>
        {!isClean ? (
          <div className="mb-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2">
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-stone-900 flex items-center gap-1.5">
                <Soup className="h-4 w-4 text-amber-600" /> Morning Aggregate Prep Board
              </h2>
              <p className="text-[11px] font-medium text-stone-500">
                Grand totals across customer freebies, paid add-ons, and store paluto kitchen requests.
              </p>
            </div>
            {onAddStorePaluto && (
              <Button
                type="button"
                size="sm"
                onClick={onAddStorePaluto}
                className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
              >
                <PlusCircle className="mr-1 h-3.5 w-3.5" /> + Add Store Paluto / Extra Prep
              </Button>
            )}
          </div>
        ) : (
          <div className="mb-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-black border-b border-black pb-1">
              SECTION 1 — MORNING AGGREGATE PREP BOARD (GRAND TOTALS)
            </h2>
          </div>
        )}

        {/* 8 High-Contrast Summary Cards */}
        <div
          className={
            isClean
              ? "grid grid-cols-4 gap-2 lg:grid-cols-8"
              : "grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8"
          }
        >
          {/* Card 1: Sarsa */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-white text-black"
                : "border border-amber-300 bg-amber-50/70 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-900">
                Sarsa (Sauce)
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-amber-950 font-mono">
                  {summary.sarsa.total}
                </span>
                <span className="text-[10px] font-bold text-amber-800">bottles</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-amber-900 leading-tight">
              <div>
                {summary.sarsa.wholeFreebies} Whole + {summary.sarsa.bellyFreebies} Belly
              </div>
              <div className="font-semibold text-amber-800">
                +{summary.sarsa.paidAddOns} Add-on +{summary.sarsa.paluto} Paluto
              </div>
              {summary.sarsa.noFreebiesSarsaGuaranteed > 0 && (
                <div className="text-[9px] font-bold text-amber-700 mt-0.5">
                  ({summary.sarsa.noFreebiesSarsaGuaranteed} Guaranteed for Less ₱2k)
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Pancit */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-white text-black"
                : "border border-orange-300 bg-orange-50/70 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-orange-900">
                Pancit (Bilao)
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-orange-950 font-mono">
                  {summary.pancit.total}
                </span>
                <span className="text-[10px] font-bold text-orange-800">bilaos</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-orange-900 leading-tight">
              <div>{summary.pancit.freebies} Freebies</div>
              <div className="font-semibold text-orange-800">
                +{summary.pancit.paidAddOns} Add-on +{summary.pancit.paluto} Paluto
              </div>
            </div>
          </div>

          {/* Card 3: Palabok */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-white text-black"
                : "border border-yellow-400 bg-yellow-50/70 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-yellow-900">
                Palabok (Bilao)
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-yellow-950 font-mono">
                  {summary.palabok.total}
                </span>
                <span className="text-[10px] font-bold text-yellow-800">bilaos</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-yellow-900 leading-tight">
              <div>{summary.palabok.freebies} Freebies</div>
              <div className="font-semibold text-yellow-800">
                +{summary.palabok.paidAddOns} Add-on +{summary.palabok.paluto} Paluto
              </div>
            </div>
          </div>

          {/* Card 4: Spaghetti */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-white text-black"
                : "border border-rose-300 bg-rose-50/70 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-rose-900">
                Spaghetti
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-rose-950 font-mono">
                  {summary.spaghetti.total}
                </span>
                <span className="text-[10px] font-bold text-rose-800">bilaos</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-rose-900 leading-tight">
              <div>{summary.spaghetti.freebies} Freebies</div>
              <div className="font-semibold text-rose-800">
                +{summary.spaghetti.paidAddOns} Add-on +{summary.spaghetti.paluto} Paluto
              </div>
            </div>
          </div>

          {/* Card 5: Dinuguan */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-white text-black"
                : "border border-stone-300 bg-stone-100/90 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-stone-800">
                Dinuguan (Cooked)
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">
                  {summary.dinuguan.total}
                </span>
                <span className="text-[10px] font-bold text-stone-700">tubs</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-stone-800 leading-tight">
              <div>{summary.dinuguan.freebies} Freebies</div>
              <div className="font-semibold text-stone-700">
                +{summary.dinuguan.paidAddOns} Add-on +{summary.dinuguan.paluto} Paluto
              </div>
              {summary.dinuguan.excludedRawInnardsOrders > 0 && (
                <div className="text-[9px] font-bold text-purple-800 mt-0.5">
                  ⚠️ {summary.dinuguan.excludedRawInnardsOrders} pig(s) excluded (Raw requested)
                </div>
              )}
            </div>
          </div>

          {/* Card 6: Puto */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-white text-black"
                : "border border-sky-300 bg-sky-50/70 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-sky-900">
                Puto (Steamed)
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-sky-950 font-mono">
                  {summary.puto.total}
                </span>
                <span className="text-[10px] font-bold text-sky-800">packs</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-sky-900 leading-tight">
              <div>{summary.puto.freebies} Freebies</div>
              <div className="font-semibold text-sky-800">
                +{summary.puto.paidAddOns} Add-on +{summary.puto.paluto} Paluto
              </div>
            </div>
          </div>

          {/* Card 7: 1.5L Coke */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-white text-black"
                : "border border-red-300 bg-red-50/70 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-red-900">
                1.5L Coke
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-red-950 font-mono">
                  {summary.coke15L.total}
                </span>
                <span className="text-[10px] font-bold text-red-800">bottles</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-red-900 leading-tight">
              <div>{summary.coke15L.freebies} Free + {summary.coke15L.bellySwaps} Belly Swaps</div>
              <div className="font-semibold text-red-800">
                +{summary.coke15L.paidAddOns} Add-on +{summary.coke15L.paluto} Paluto
              </div>
            </div>
          </div>

          {/* Card 8: Raw Innards (Hilaw) */}
          <div
            className={`rounded-md p-2.5 flex flex-col justify-between ${
              isClean
                ? "border-2 border-black bg-slate-100 text-black"
                : "border-2 border-purple-400 bg-purple-50/80 shadow-xs"
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-purple-950">
                🥩 Raw Innards (Hilaw)
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-purple-950 font-mono">
                  {summary.rawInnardsHilaw.total}
                </span>
                <span className="text-[10px] font-bold text-purple-900">bags</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-purple-950 leading-tight">
              <div className="font-bold text-[9px] text-purple-900 uppercase">
                DO NOT COOK AS DINUGUAN
              </div>
              <div className="font-semibold text-purple-800">
                {summary.rawInnardsHilaw.bags} Walang Dinuguan
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHRONOLOGICAL KITCHEN PACKING & PREP ROSTER */}
      <div>
        {!isClean ? (
          <div className="mb-2 border-b border-stone-200 pb-1.5 pt-2">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-stone-900 flex items-center gap-1.5">
              <UtensilsCrossed className="h-4 w-4 text-emerald-600" /> Chronological Kitchen Packing & Prep Roster
            </h2>
            <p className="text-[11px] font-medium text-stone-500">
              Checklist of freebies, bilao swaps, paid add-ons, and store paluto sorted by time needed.
            </p>
          </div>
        ) : (
          <div className="mb-2 mt-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-black border-b border-black pb-1">
              SECTION 2 — CHRONOLOGICAL KITCHEN PACKING & PREP ROSTER
            </h2>
          </div>
        )}

        {/* 100% Zero-Scroll Table Container */}
        <div
          className={`w-full rounded-md border-2 border-black ${
            isClean ? "overflow-visible no-scrollbar" : "overflow-x-auto"
          } print:overflow-visible bg-white shadow-xs`}
        >
          <table
            className={`w-full table-fixed border-collapse text-left text-xs ${
              isClean ? "w-full" : "min-w-[1050px] xl:min-w-full"
            }`}
          >
            {/* Proportional Column Allocation (Total = 100%) */}
            <colgroup>
              <col className="w-[10%] min-w-[95px]" />   {/* 1. Time Needed */}
              <col className="w-[18%] min-w-[160px]" />  {/* 2. Order / Recipient */}
              <col className="w-[13%] min-w-[110px]" />  {/* 3. Type / Item */}
              <col className="w-[14%] min-w-[120px]" />  {/* 4. Fulfillment / Route */}
              <col className="w-[30%] min-w-[260px]" />  {/* 5. Checklist Pills */}
              <col className="w-[15%] min-w-[130px]" />  {/* 6. Remarks */}
            </colgroup>

            {/* High-Contrast Bold Table Header */}
            <thead className="bg-black text-white">
              <tr className="border-b-2 border-black">
                <th className="px-2 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">
                  TIME NEEDED
                </th>
                <th className="px-2.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">
                  ORDER / RECIPIENT
                </th>
                <th className="px-2.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">
                  TYPE / ITEM
                </th>
                <th className="px-2.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">
                  FULFILLMENT / ROUTE
                </th>
                <th className="px-2.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700 bg-amber-950 text-amber-300">
                  FREEBIES & SIDES TO PACK (CHECKLIST)
                </th>
                <th className="px-2.5 py-2.5 text-left font-black uppercase text-[11px]">
                  REMARKS / SPECIAL REQUESTS
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-300 bg-white">
              {scheduledRows.length === 0 && timeTbdRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    No orders or store paluto items scheduled for this date.
                  </td>
                </tr>
              ) : (
                scheduledRows.map(renderRosterRow)
              )}

              {/* Time TBD Group Divider and Rows */}
              {timeTbdRows.length > 0 && (
                <>
                  <tr className="bg-amber-100/90 border-y-2 border-amber-400">
                    <td
                      colSpan={6}
                      className="px-3 py-2 text-center text-amber-950 font-black text-xs uppercase tracking-wider"
                    >
                      ⚠️ AWAITING CUSTOMER SERVING TIME — DO NOT PACK UNTIL CONFIRMED
                    </td>
                  </tr>
                  {timeTbdRows.map(renderRosterRow)}
                </>
              )}
            </tbody>

            {/* Clean High-Contrast Footer Summary */}
            <tfoot className="bg-slate-100 border-t-2 border-black font-semibold text-slate-900 text-[11px]">
              <tr>
                <td
                  colSpan={2}
                  className="px-3 py-2.5 text-left font-black uppercase tracking-wider border-r border-slate-300"
                >
                  Total Deliveries & Preps: {roster.length}
                </td>
                <td
                  colSpan={3}
                  className="px-3 py-2.5 text-left font-bold border-r border-slate-300"
                >
                  Orders:{" "}
                  <span className="font-black text-slate-900">
                    {roster.filter((r) => !r.isPrepRequest).length}
                  </span>
                  <span className="mx-2 text-slate-400">|</span>
                  Store Paluto:{" "}
                  <span className="font-black text-indigo-900">
                    {roster.filter((r) => r.isPrepRequest).length}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-black uppercase text-slate-700">
                  YUMI LECHON KITCHEN PREP
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FreebiesPrepViewTab;
