import { useState } from "react";
import { useRoastingRoster, RoastingScheduleItem } from "@/hooks/useSchedules";
import { useRidersQuery } from "@/hooks/useRiders";
import { InlineScheduleEditorModal } from "./InlineScheduleEditorModal";
import { Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  generateDispatchNotification,
  TemplateOrderData,
} from "@/utils/messengerTemplates";

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

const formatWeightDisplay = (weight?: string | null): string => {
  if (!weight) return "-";
  return weight
    .replace(/\s*kg\b/gi, "")
    .replace(/\.00\b/g, "")
    .replace(/\.0\b/g, "")
    .trim() || "-";
};

export function RiderViewTab({ mode = "edit" }: RiderViewTabProps) {
  const { data: scheduleItems, isLoading, isError } = useRoastingRoster();
  const [selectedItem, setSelectedItem] = useState<RoastingScheduleItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { data: registeredRiders = [] } = useRidersQuery();

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

  const handleCopyDispatch = (item: RoastingScheduleItem) => {
    const matchedRider = registeredRiders.find(
      (r) => r.fullName.toLowerCase() === item.riderName?.trim().toLowerCase()
    );

    const price = Number(item.price) || 0;
    const addOns = Number(item.addOns) || 0;
    const deliveryFee = Number(item.deliveryFee) || 0;
    const lechonFee =
      item.lechonFee !== undefined && item.lechonFee !== null
        ? Number(item.lechonFee)
        : price + addOns;
    const amountToCollect = lechonFee + deliveryFee;

    const orderData: TemplateOrderData = {
      orderNumber: item.orderId || item.id,
      customerName: item.customerName || "Customer",
      targetDeliveryTime: item.targetDeliveryTime,
      fulfillment: item.fulfillment ?? 1,
      deliveryAddress: item.location || "",
      landmark: item.landmark || undefined,
      items: [
        {
          categoryName: item.size || "Lechon",
          quantity: item.quantity || 1,
        },
      ],
      subtotal: price,
      deliveryFee: deliveryFee,
      grandTotal: item.grandTotal ?? (price + addOns + deliveryFee),
      downpayment: Number(item.downpayment) || 0,
      balanceDue: amountToCollect,
      remarks: item.remarks,
    };

    const alertText = generateDispatchNotification(orderData, {
      name: item.riderName || "Freelance Courier",
      phone: matchedRider?.phoneNumber,
    });

    navigator.clipboard.writeText(alertText);
    const alertType =
      item.fulfillment === 0
        ? "Pickup alert"
        : item.fulfillment === 2
        ? "Lalamove alert"
        : "Dispatch alert";
    toast.success(`${alertType} copied for Messenger!`);
  };

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
      <div className="w-full rounded-md border-2 border-black overflow-x-auto print:overflow-visible bg-white shadow-xs">
        <table className="w-full table-fixed border-collapse text-left text-xs min-w-[1100px] xl:min-w-full">
          {/* Proportional Column Allocation: Total = 100%, No Horizontal Overflow */}
          <colgroup>
            <col className="w-[8%] min-w-[130px]" />  {/* 1. No. */}
            <col className="w-[7.5%]" />              {/* 2. Size */}
            <col className="w-[5.5%]" />              {/* 3. Weight */}
            <col className="w-[6.5%]" />              {/* 4. Delivery Time */}
            <col className="w-[8.5%]" />              {/* 5. Customer Name */}
            <col className="w-[15%]" />               {/* 6. Location (Expanded) */}
            <col className="w-[7.5%]" />              {/* 7. Rider Name */}
            <col className="w-[15%]" />               {/* 8. Remarks (Expanded) */}
            <col className="w-[5.5%]" />              {/* 9. Price */}
            <col className="w-[4%]" />                {/* 10. Add-ons */}
            <col className="w-[4.5%]" />              {/* 11. Delivery Fee */}
            <col className="w-[5%]" />                {/* 12. Lechon Fee */}
            <col className="w-[8%]" />                {/* 13. Amount to Collect */}
          </colgroup>

          {/* High-Contrast Bold Table Header */}
          <thead className="bg-black text-white">
            <tr className="border-b-2 border-black">
              <th className="px-2 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 min-w-[130px] whitespace-nowrap font-mono font-bold">No.</th>
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
                  <td className="px-2 py-2 text-center text-slate-800 border-r border-slate-300 text-xs min-w-[130px] whitespace-nowrap font-mono font-bold">
                    #{item.orderReference || item.orderId || item.id}
                  </td>

                  {/* 2. Size */}
                  <td className="px-1.5 py-2 font-bold text-slate-800 border-r border-slate-300 leading-tight">
                    {item.size || "-"}
                  </td>

                  {/* 3. Weight */}
                  <td className="px-1.5 py-2 text-center font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {formatWeightDisplay(item.weight)}
                  </td>

                  {/* 4. Delivery Time (High-Visibility Bold Red) */}
                  <td className="px-1.5 py-2 text-center font-black text-red-600 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap">
                    <div>{formatTime(item.targetDeliveryTime)}</div>
                    {item.riderDepartureTime && item.fulfillment !== 0 && (
                      <div className="text-[9.5px] text-amber-800 font-bold">
                        🛵 Dep: {formatTime(item.riderDepartureTime)}
                      </div>
                    )}
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
                    <div>{item.location || "-"}</div>
                    {item.landmark && (
                      <div className="text-[9.5px] text-amber-800 font-semibold mt-0.5">
                        🧭 {item.landmark}
                      </div>
                    )}
                  </td>

                  {/* 7. Rider Name (Editable in edit mode) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-center text-[11px] font-bold border-r border-slate-300 ${editableCellClass}`}
                    title={isEdit ? "Click to assign or change rider" : undefined}
                  >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <div className="flex items-center justify-center gap-1">
                        {item.fulfillment === 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300 font-semibold text-[10px]">
                            🏪 Store Pickup
                          </span>
                        ) : item.fulfillment === 2 ? (
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300 font-semibold text-[10px]">
                            📦 Lalamove Courier
                          </span>
                        ) : (
                          <span
                            className={
                              item.riderName && item.riderName !== "Unassigned"
                                ? "text-blue-700 font-bold"
                                : "text-slate-400 italic font-normal"
                            }
                          >
                            {item.riderName || "Unassigned"}
                          </span>
                        )}
                        {isEdit && (
                          <Pencil className="w-2.5 h-2.5 text-amber-600 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                      {((item.riderName && item.riderName !== "Unassigned") || item.fulfillment === 0 || item.fulfillment === 2) && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[9px] font-semibold print:hidden shadow-2xs transition-colors mt-0.5"
                          title="Copy Messenger Alert"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyDispatch(item);
                          }}
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>
                            {item.fulfillment === 0
                              ? "Pickup Alert"
                              : item.fulfillment === 2
                              ? "Lalamove Alert"
                              : "Dispatch Alert"}
                          </span>
                        </button>
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
