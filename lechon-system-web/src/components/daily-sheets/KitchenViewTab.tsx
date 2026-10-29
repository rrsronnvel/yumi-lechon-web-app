import { useState } from "react";
import { useDailySheets, RoastingScheduleItem } from "@/hooks/useSchedules";
import { InlineScheduleEditorModal } from "./InlineScheduleEditorModal";
import { Pencil } from "lucide-react";
import { sanitizeFreebiesSummary } from "@/utils/freebiesHelper";
import { WalkInBadge } from "@/components/WalkInBadge";
import { isWalkInOrder } from "@/utils/walkIn";

interface KitchenViewTabProps {
  mode?: "edit" | "clean";
  selectedDate?: string;
}

// Bulletproof Time Formatter
const formatTime = (timeString?: string) => {
  if (!timeString) return "-";

  try {
    if (timeString.length <= 8 && timeString.includes(":")) {
      const [hours, minutes] = timeString.split(":");
      const hourNum = parseInt(hours, 10);
      const ampm = hourNum >= 12 ? "PM" : "AM";
      const formattedHour = hourNum % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    }

    const dateObj = new Date(timeString);
    if (isNaN(dateObj.getTime())) return "Invalid";

    return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Error";
  }
};

const formatWeightDisplay = (weight?: string | null): string => {
  if (!weight || weight === "-") return "-";
  return weight
    .replace(/\s*kg\b/gi, "")
    .replace(/\.00\b/g, "")
    .replace(/\.0\b/g, "")
    .trim() || "-";
};

export function KitchenViewTab({ mode = "edit", selectedDate }: KitchenViewTabProps) {
  const { data: dailySheets, isLoading, isError } = useDailySheets(selectedDate);
  const [selectedItem, setSelectedItem] = useState<RoastingScheduleItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  if (isLoading)
    return <div className="p-8 text-center text-muted-foreground font-medium">Loading roasting schedule...</div>;
  if (isError)
    return <div className="p-8 text-center text-red-500 font-medium">Failed to load roasting schedule.</div>;

  const rawRoster = dailySheets?.items || [];
  if (rawRoster.length === 0)
    return <div className="p-8 text-center text-muted-foreground">No orders scheduled for the selected date.</div>;

  // Dynamic Chronological Priority Sorting:
  // - Roast items (with valid tahiStartTime) sort chronologically first (Priority 1, 2, 3...)
  // - Non-lechon items (tahiStartTime == null) sort at the bottom by RiderDepartureTime
  const sortedRoster = [...rawRoster].sort((a, b) => {
    const hasTahiA = !!a.tahiStartTime;
    const hasTahiB = !!b.tahiStartTime;

    if (hasTahiA && hasTahiB) {
      const timeA = new Date(a.tahiStartTime).getTime();
      const timeB = new Date(b.tahiStartTime).getTime();
      return timeA - timeB;
    }

    if (hasTahiA && !hasTahiB) return -1;
    if (!hasTahiA && hasTahiB) return 1;

    const timeA = new Date(a.riderDepartureTime ?? a.targetDeliveryTime ?? 0).getTime();
    const timeB = new Date(b.riderDepartureTime ?? b.targetDeliveryTime ?? 0).getTime();
    return timeA - timeB;
  });

  const handleCellClick = (item: RoastingScheduleItem) => {
    if (mode === "clean") return;
    setSelectedItem(item);
    setIsEditorOpen(true);
  };

  const isEdit = mode === "edit";

  return (
    <div className="space-y-3 w-full">
      {/* 100% Zero-Scroll Table Container */}
      <div className={`w-full rounded-md border-2 border-black ${mode === "clean" ? "overflow-visible no-scrollbar" : "overflow-x-auto"} print:overflow-visible bg-white shadow-xs`}>
        <table className={`w-full table-fixed border-collapse text-left text-xs ${mode === "clean" ? "w-full" : "min-w-[1100px] xl:min-w-full"}`}>
          {/* Proportional Column Allocation: Total = 100%, No Horizontal Overflow */}
          <colgroup>
            <col className="w-[8%] min-w-[115px]" />  {/* 1. No. */}
            <col className="w-[5.5%]" />              {/* 2. Tahi */}
            <col className="w-[5.5%]" />              {/* 3. Salang */}
            <col className="w-[5%]" />                {/* 4. Priority */}
            <col className="w-[4.5%]" />              {/* 5. Size (Compact: fits "S. Jumbo") */}
            <col className="w-[4.5%]" />              {/* 6. Weight */}
            <col className="w-[7%]" />                {/* 7. Departure / Pickup */}
            <col className="w-[8.5%]" />              {/* 8. Customer Name */}
            <col className="w-[18%]" />               {/* 9. Remarks (Expanded) */}
            <col className="w-[18%]" />               {/* 10. Location (Expanded) */}
            <col className="w-[4%]" />                {/* 11. Add-ons */}
            <col className="w-[5.5%]" />              {/* 12. Delivery Time */}
            <col className="w-[6.5%]" />              {/* 13. Rider Name */}
          </colgroup>

          {/* High-Contrast Bold Table Header */}
          <thead className="bg-black text-white">
            <tr className="border-b-2 border-black">
              <th className="px-2 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 min-w-[115px] whitespace-nowrap font-mono font-bold">No.</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 bg-red-950 text-red-300">Tahi</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Salang</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Priority</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 whitespace-nowrap">Size</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Weight</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 bg-amber-950 text-amber-300">Departure / Pickup</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Customer</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Remarks</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Location</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Add-ons</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Delivery</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px]">Rider</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-300 bg-white">
            {sortedRoster.map((item, index) => {
              const hasTahi = !!item.tahiStartTime;
              const editableCellClass = isEdit && hasTahi
                ? "cursor-pointer transition-colors hover:bg-amber-100/70 group"
                : "";
              const freebiesSummary = sanitizeFreebiesSummary(item.freebiesSummary);
              const minW = Number(item.minimumWeightKg ?? item.minWeight ?? 0);
              const displayWeight = hasTahi && minW > 0 ? formatWeightDisplay(item.weight) : "-";
              const isWalkIn = isWalkInOrder(item);

              return (
                <tr
                  key={item.id}
                  className={`${isWalkIn && isEdit ? "bg-indigo-50/40" : "even:bg-slate-50 odd:bg-white"} text-slate-900 hover:bg-amber-50/40`}
                >
                  {/* 1. No. */}
                  <td className="px-2 py-2 text-center text-slate-800 border-r border-slate-300 text-xs min-w-[115px] whitespace-nowrap font-mono font-bold">
                    #{item.orderReference || item.orderId || item.id}
                  </td>

                  {/* 2. Tahi (Editable in edit mode for roast items, High-Visibility Bold Red) */}
                  <td
                    onClick={() => hasTahi && handleCellClick(item)}
                    className={`px-1.5 py-2 text-center font-black text-red-600 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap ${editableCellClass}`}
                    title={isEdit && hasTahi ? "Click to override production timings" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatTime(item.tahiStartTime)}</span>
                      {isEdit && hasTahi && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* 3. Salang (Editable in edit mode for roast items, Bold Black) */}
                  <td
                    onClick={() => hasTahi && handleCellClick(item)}
                    className={`px-1.5 py-2 text-center font-extrabold text-slate-900 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap ${editableCellClass}`}
                    title={isEdit && hasTahi ? "Click to override production timings" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatTime(item.salangStartTime)}</span>
                      {isEdit && hasTahi && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* 4. Priority (Dynamic index + 1 for roast items, dash for non-lechon) */}
                  <td className="px-1.5 py-2 text-center font-black border-r border-slate-300 whitespace-nowrap">
                    {hasTahi ? (
                      isEdit ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px]">
                          P{index + 1}
                          {item.isManualOverride && (
                            <span
                              className="bg-amber-600 text-white rounded text-[8px] px-1 font-bold"
                              title="Manual override active"
                            >
                              MOD
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="font-black text-slate-900 text-[11px] sm:text-xs">Priority {index + 1}</span>
                      )
                    ) : (
                      <span className="font-bold text-slate-400 text-xs">-</span>
                    )}
                  </td>

                  {/* 5. Size (Compact & Centered: fits "S. Jumbo" without wrapping) */}
                  <td className="px-1.5 py-2 text-center font-bold text-slate-800 border-r border-slate-300 whitespace-nowrap text-xs">
                    {item.size || item.categoryName || "-"}
                  </td>

                  {/* 6. Weight */}
                  <td className="px-1.5 py-2 text-center font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {displayWeight}
                  </td>

                  {/* 7. Departure / Pickup Time (Editable in edit mode) */}
                  <td
                    onClick={() => hasTahi && handleCellClick(item)}
                    className={`px-1.5 py-2 text-center font-mono font-bold text-amber-900 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap ${editableCellClass}`}
                    title={isEdit && hasTahi ? "Click to override departure or production timings" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatTime(item.riderDepartureTime ?? item.targetDeliveryTime)}</span>
                      {isEdit && hasTahi && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* 8. Customer Name */}
                  <td className="px-1.5 py-2 font-bold text-slate-900 border-r border-slate-300 break-words leading-tight">
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{item.customerName || "-"}</span>
                      <WalkInBadge
                        source={item.source}
                        customerName={item.customerName}
                        facebookName={item.facebookName}
                        clean={!isEdit}
                      />
                    </div>
                    {item.facebookName &&
                      item.facebookName.toLocaleLowerCase() !== item.customerName?.toLocaleLowerCase() && (
                        <div className="mt-0.5 text-[9px] font-semibold text-slate-500">
                          {item.facebookName}
                        </div>
                      )}
                  </td>

                  {/* 9. Remarks (Wrap naturally without truncation!) */}
                  <td
                    onClick={() => hasTahi && handleCellClick(item)}
                    className={`px-1.5 py-2 text-slate-800 border-r border-slate-300 text-[10.5px] sm:text-[11px] font-medium leading-tight break-words ${editableCellClass}`}
                    title={[freebiesSummary, item.remarks].filter(Boolean).join(" • ") || undefined}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="space-y-1">
                        {freebiesSummary && (
                          <span
                            className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                              freebiesSummary === "🚫 No Freebies"
                                ? "bg-rose-100 text-rose-800 border-rose-300"
                                : freebiesSummary.includes("Raw Innards") ||
                                    freebiesSummary.includes(":")
                                  ? "bg-amber-100 text-amber-900 border-amber-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            {freebiesSummary}
                          </span>
                        )}
                        <span className="block break-words">{item.remarks || "-"}</span>
                      </div>
                      {isEdit && hasTahi && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </td>

                  {/* 10. Location (Wrap naturally without truncation!) */}
                  <td
                    className="px-1.5 py-2 text-slate-800 border-r border-slate-300 text-[10.5px] sm:text-[11px] font-medium leading-tight break-words"
                    title={item.location || undefined}
                  >
                    <div>{item.location || "-"}</div>
                    {item.landmark && (
                      <div className="text-[9.5px] text-amber-800 font-semibold mt-0.5">
                        🧭 {item.landmark}
                      </div>
                    )}
                  </td>

                  {/* 11. Add-ons */}
                  <td className="px-1.5 py-2 text-center text-slate-700 border-r border-slate-300 text-[11px] font-medium break-words">
                    {item.addOns || "-"}
                  </td>

                  {/* 12. Delivery Time */}
                  <td className="px-1.5 py-2 text-center font-bold text-slate-900 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap">
                    {formatTime(item.targetDeliveryTime)}
                  </td>

                  {/* 13. Rider Name */}
                  <td
                    onClick={() => hasTahi && handleCellClick(item)}
                    className={`px-1.5 py-2 text-center text-[11px] font-bold ${editableCellClass}`}
                    title={isEdit && hasTahi ? "Click to assign or change rider" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={
                          item.riderName && item.riderName !== "Unassigned"
                            ? "text-blue-700 font-bold"
                            : "text-slate-400 italic font-normal"
                        }
                      >
                        {item.riderName || "Unassigned"}
                      </span>
                      {isEdit && hasTahi && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Clean High-Contrast Footer Summary */}
          <tfoot className="bg-slate-100 border-t-2 border-black font-semibold text-slate-900 text-[11px]">
            <tr>
              <td colSpan={4} className="px-3 py-2.5 text-left font-black uppercase tracking-wider border-r border-slate-300">
                Total Orders: {sortedRoster.length}
              </td>
              <td colSpan={6} className="px-3 py-2.5 text-left font-bold border-r border-slate-300">
                First Tahi: <span className="text-red-700 font-black">{formatTime(sortedRoster.find((r) => !!r.tahiStartTime)?.tahiStartTime)}</span>
                <span className="mx-2 text-slate-400">|</span>
                First Salang: <span className="text-black font-black">{formatTime(sortedRoster.find((r) => !!r.salangStartTime)?.salangStartTime)}</span>
              </td>
              <td colSpan={3} className="px-3 py-2.5 text-right font-black uppercase text-slate-700">
                YUMI LECHON KITCHEN
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Inline Schedule Override Modal */}
      <InlineScheduleEditorModal
        item={selectedItem}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
      />
    </div>
  );
}

export default KitchenViewTab;
