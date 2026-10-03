import { useState } from "react";
import { useRoastingRoster, RoastingScheduleItem } from "@/hooks/useSchedules";
import { InlineScheduleEditorModal } from "./InlineScheduleEditorModal";
import { Pencil } from "lucide-react";

interface RiderViewTabProps {
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

// Formatting helper for Philippine Peso
const formatPHP = (amount: number) => {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
};

export function RiderViewTab({ mode = "edit" }: RiderViewTabProps) {
  const { data: scheduleItems, isLoading, isError } = useRoastingRoster();
  const [selectedItem, setSelectedItem] = useState<RoastingScheduleItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  if (isLoading)
    return <div className="p-8 text-center text-muted-foreground font-medium">Loading logistics schedule...</div>;
  if (isError)
    return <div className="p-8 text-center text-red-500 font-medium">Failed to load logistics schedule.</div>;
  if (!scheduleItems || scheduleItems.length === 0)
    return <div className="p-8 text-center text-muted-foreground">No deliveries scheduled for the selected date.</div>;

  // Sort chronologically by Delivery Time for the Riders
  const sortedByDelivery = [...scheduleItems].sort((a, b) => {
    return new Date(a.targetDeliveryTime).getTime() - new Date(b.targetDeliveryTime).getTime();
  });

  const handleCellClick = (item: RoastingScheduleItem) => {
    if (mode === "clean") return;
    setSelectedItem(item);
    setIsEditorOpen(true);
  };

  const isEdit = mode === "edit";

  // Financial summary calculations
  const totalAmountToCollect = sortedByDelivery.reduce((acc, item) => {
    const price = Number(item.price) || 0;
    const addOns = Number(item.addOns) || 0;
    const deliveryFee = Number(item.deliveryFee) || 0;
    const lechonFee = item.lechonFee !== undefined && item.lechonFee !== null ? Number(item.lechonFee) : price + addOns;
    return acc + (lechonFee + deliveryFee);
  }, 0);

  return (
    <div className="space-y-3 w-full">
      {/* 100% Zero-Scroll Table Container */}
      <div className="w-full rounded-md border-2 border-black overflow-hidden bg-white shadow-xs">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          {/* Proportional Column Allocation: Total = 100%, No Horizontal Overflow */}
          <colgroup>
            <col className="w-[4%]" />    {/* 1. No. */}
            <col className="w-[8.5%]" />  {/* 2. Size */}
            <col className="w-[7%]" />    {/* 3. Weight */}
            <col className="w-[8%]" />    {/* 4. Delivery Time */}
            <col className="w-[10%]" />   {/* 5. Customer Name */}
            <col className="w-[14%]" />   {/* 6. Location */}
            <col className="w-[9%]" />    {/* 7. Rider Name */}
            <col className="w-[12%]" />   {/* 8. Remarks */}
            <col className="w-[7%]" />    {/* 9. Price */}
            <col className="w-[5%]" />    {/* 10. Add-ons */}
            <col className="w-[7%]" />    {/* 11. Delivery Fee */}
            <col className="w-[7.5%]" />  {/* 12. Lechon Fee */}
            <col className="w-[11%]" />   {/* 13. Amount to Collect */}
          </colgroup>

          {/* High-Contrast Bold Table Header */}
          <thead className="bg-black text-white">
            <tr className="border-b-2 border-black">
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">No.</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Size</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Weight</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 bg-red-950 text-red-300">Delivery</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Customer</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Location</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Rider</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Remarks</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Price</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Add-ons</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Del Fee</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Lechon</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] bg-slate-900 text-green-300">
                To Collect
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-300 bg-white">
            {sortedByDelivery.map((item) => {
              const price = Number(item.price) || 0;
              const addOns = Number(item.addOns) || 0;
              const deliveryFee = Number(item.deliveryFee) || 0;

              const lechonFee =
                item.lechonFee !== undefined && item.lechonFee !== null
                  ? Number(item.lechonFee)
                  : price + addOns;

              const amountToCollect = lechonFee + deliveryFee;

              const editableCellClass = isEdit
                ? "cursor-pointer transition-colors hover:bg-amber-100/70 group"
                : "";

              return (
                <tr
                  key={item.id}
                  className="even:bg-slate-50 odd:bg-white text-slate-900 hover:bg-amber-50/40"
                >
                  {/* 1. No. */}
                  <td className="px-1.5 py-2 text-center font-black text-slate-800 border-r border-slate-300">
                    {item.orderId || item.id}
                  </td>

                  {/* 2. Size */}
                  <td className="px-1.5 py-2 font-bold text-slate-800 border-r border-slate-300 leading-tight">
                    {item.size || "-"}
                  </td>

                  {/* 3. Weight (KG) */}
                  <td className="px-1.5 py-2 text-center font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {item.weight || "-"}
                  </td>

                  {/* 4. Delivery Time (High-Visibility Bold Red) */}
                  <td className="px-1.5 py-2 text-center font-black text-red-600 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap">
                    {formatTime(item.targetDeliveryTime)}
                  </td>

                  {/* 5. Customer Name */}
                  <td className="px-1.5 py-2 font-bold text-slate-900 border-r border-slate-300 break-words leading-tight">
                    {item.customerName || "-"}
                  </td>

                  {/* 6. Location (Wrap naturally without truncation!) */}
                  <td
                    className="px-1.5 py-2 text-slate-800 border-r border-slate-300 text-[10.5px] sm:text-[11px] font-medium leading-tight break-words"
                    title={item.location || undefined}
                  >
                    {item.location || "-"}
                  </td>

                  {/* 7. Rider Name (Editable in edit mode) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-center text-[11px] font-bold border-r border-slate-300 ${editableCellClass}`}
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

                  {/* 8. Remarks (Wrap naturally without truncation!) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-slate-800 border-r border-slate-300 text-[10.5px] sm:text-[11px] font-medium leading-tight break-words ${editableCellClass}`}
                    title={item.remarks || undefined}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="break-words">{item.remarks || "-"}</span>
                      {isEdit && (
                        <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </td>

                  {/* 9. Price */}
                  <td className="px-1.5 py-2 text-right font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {formatPHP(price)}
                  </td>

                  {/* 10. Add-ons */}
                  <td className="px-1.5 py-2 text-right font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {formatPHP(addOns)}
                  </td>

                  {/* 11. Delivery Fee */}
                  <td className="px-1.5 py-2 text-right font-bold text-amber-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {formatPHP(deliveryFee)}
                  </td>

                  {/* 12. Lechon Fee */}
                  <td className="px-1.5 py-2 text-right font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {formatPHP(lechonFee)}
                  </td>

                  {/* 13. Amount to Collect */}
                  <td className="px-1.5 py-2 text-right font-black text-xs sm:text-[13px] text-green-700 bg-green-50/70 whitespace-nowrap">
                    {formatPHP(amountToCollect)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Clean High-Contrast Footer Summary */}
          <tfoot className="bg-slate-100 border-t-2 border-black font-semibold text-slate-900 text-[11px]">
            <tr>
              <td colSpan={5} className="px-3 py-2 text-left font-black uppercase tracking-wider border-r border-slate-300">
                Total Deliveries: {sortedByDelivery.length}
              </td>
              <td colSpan={4} className="px-3 py-2 text-left font-bold border-r border-slate-300">
                Logistics Dispatch Manifest
              </td>
              <td colSpan={4} className="px-3 py-2 text-right font-black text-green-800 text-xs sm:text-[13px] uppercase">
                Total Cash to Collect: {formatPHP(totalAmountToCollect)}
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

export default RiderViewTab;
