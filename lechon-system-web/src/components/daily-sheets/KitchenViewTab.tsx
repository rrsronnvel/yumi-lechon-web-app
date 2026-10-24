import { useState } from "react";
import { useRoastingRoster, RoastingScheduleItem } from "@/hooks/useSchedules";
import { InlineScheduleEditorModal } from "./InlineScheduleEditorModal";
import { Pencil } from "lucide-react";

interface KitchenViewTabProps {
  mode?: "edit" | "clean";
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
  if (!weight) return "-";
  return weight
    .replace(/\s*kg\b/gi, "")
    .replace(/\.00\b/g, "")
    .replace(/\.0\b/g, "")
    .trim() || "-";
};

export function KitchenViewTab({ mode = "edit" }: KitchenViewTabProps) {
  const { data: scheduleItems, isLoading, isError } = useRoastingRoster();
  const [selectedItem, setSelectedItem] = useState<RoastingScheduleItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  if (isLoading)
    return <div className="p-8 text-center text-muted-foreground font-medium">Loading roasting schedule...</div>;
  if (isError)
    return <div className="p-8 text-center text-red-500 font-medium">Failed to load roasting schedule.</div>;
  if (!scheduleItems || scheduleItems.length === 0)
    return <div className="p-8 text-center text-muted-foreground">No orders scheduled for the selected date.</div>;

  // Dynamic Chronological Priority Sorting by Tahi Time
  const sortedRoster = [...scheduleItems].sort((a, b) => {
    const timeA = a.tahiStartTime ? new Date(a.tahiStartTime).getTime() : 0;
    const timeB = b.tahiStartTime ? new Date(b.tahiStartTime).getTime() : 0;
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
      <div className="w-full rounded-md border-2 border-black overflow-x-auto print:overflow-visible bg-white shadow-xs">
        <table className="w-full table-fixed border-collapse text-left text-xs min-w-[1100px] xl:min-w-full">
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
            <col className="w-[5.5%]" />              {/* 9. Packaging Time */}
            <col className="w-[15%]" />               {/* 10. Remarks (Expanded) */}
            <col className="w-[15%]" />               {/* 11. Location (Expanded) */}
            <col className="w-[4%]" />                {/* 12. Add-ons */}
            <col className="w-[5.5%]" />              {/* 13. Delivery Time */}
            <col className="w-[6.5%]" />              {/* 14. Rider Name */}
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
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Packaging</th>
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
              const editableCellClass = isEdit
                ? "cursor-pointer transition-colors hover:bg-amber-100/70 group"
                : "";

              return (
                <tr
                  key={item.id}
                  className="even:bg-slate-50 odd:bg-white text-slate-900 hover:bg-amber-50/40"
                >
                  {/* 1. No. */}
                  <td className="px-2 py-2 text-center text-slate-800 border-r border-slate-300 text-xs min-w-[115px] whitespace-nowrap font-mono font-bold">
                    #{item.orderReference || item.orderId || item.id}
                  </td>

                  {/* 2. Tahi (Editable in edit mode, High-Visibility Bold Red) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-center font-black text-red-600 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap ${editableCellClass}`}
                    title={isEdit ? "Click to override production timings" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatTime(item.tahiStartTime)}</span>
                      {isEdit && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* 3. Salang (Editable in edit mode, Bold Black) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-center font-extrabold text-slate-900 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap ${editableCellClass}`}
                    title={isEdit ? "Click to override production timings" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatTime(item.salangStartTime)}</span>
                      {isEdit && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* 4. Priority (Dynamic index + 1) */}
                  <td className="px-1.5 py-2 text-center font-black border-r border-slate-300 whitespace-nowrap">
                    {isEdit ? (
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
                    )}
                  </td>

                  {/* 5. Size (Compact & Centered: fits "S. Jumbo" without wrapping) */}
                  <td className="px-1.5 py-2 text-center font-bold text-slate-800 border-r border-slate-300 whitespace-nowrap text-xs">
                    {item.size || "-"}
                  </td>

                  {/* 6. Weight */}
                  <td className="px-1.5 py-2 text-center font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {formatWeightDisplay(item.weight)}
                  </td>

                  {/* 7. Departure / Pickup Time (Editable in edit mode) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-center font-mono font-bold text-amber-900 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap ${editableCellClass}`}
                    title={isEdit ? "Click to override departure or production timings" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatTime(item.riderDepartureTime ?? item.targetDeliveryTime)}</span>
                      {isEdit && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* 8. Customer Name */}
                  <td className="px-1.5 py-2 font-bold text-slate-900 border-r border-slate-300 break-words leading-tight">
                    {item.customerName || "-"}
                  </td>

                  {/* 9. Packaging Time */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-center font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap ${editableCellClass}`}
                    title={isEdit ? "Click to override production timings" : undefined}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{formatTime(item.packagingStartTime)}</span>
                      {isEdit && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* 10. Remarks (Wrap naturally without truncation!) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-slate-800 border-r border-slate-300 text-[10.5px] sm:text-[11px] font-medium leading-tight break-words ${editableCellClass}`}
                    title={[item.freebiesSummary, item.remarks].filter(Boolean).join(" • ") || undefined}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="space-y-1">
                        {item.freebiesSummary && (
                          <span
                            className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                              item.freebiesSummary === "🚫 No Freebies"
                                ? "bg-rose-100 text-rose-800 border-rose-300"
                                : item.freebiesSummary.includes("Raw Innards") ||
                                    item.freebiesSummary.includes(":")
                                  ? "bg-amber-100 text-amber-900 border-amber-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            {item.freebiesSummary}
                          </span>
                        )}
                        <span className="block break-words">{item.remarks || "-"}</span>
                      </div>
                      {isEdit && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </td>

                  {/* 11. Location (Wrap naturally without truncation!) */}
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

                  {/* 12. Add-ons */}
                  <td className="px-1.5 py-2 text-center text-slate-700 border-r border-slate-300 text-[11px] font-medium break-words">
                    {item.addOns || "-"}
                  </td>

                  {/* 13. Delivery Time */}
                  <td className="px-1.5 py-2 text-center font-bold text-slate-900 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap">
                    {formatTime(item.targetDeliveryTime)}
                  </td>

                  {/* 14. Rider Name */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-center text-[11px] font-bold ${editableCellClass}`}
                    title={isEdit ? "Click to assign or change rider" : undefined}
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
                      {isEdit && (
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
              <td colSpan={4} className="px-3 py-2 text-left font-black uppercase tracking-wider border-r border-slate-300">
                Total Orders: {sortedRoster.length}
              </td>
              <td colSpan={6} className="px-3 py-2 text-left font-bold border-r border-slate-300">
                First Tahi: <span className="text-red-700 font-black">{formatTime(sortedRoster[0]?.tahiStartTime)}</span>
                <span className="mx-2 text-slate-400">|</span>
                First Salang: <span className="text-black font-black">{formatTime(sortedRoster[0]?.salangStartTime)}</span>
              </td>
              <td colSpan={4} className="px-3 py-2 text-right font-black uppercase text-slate-700">
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
