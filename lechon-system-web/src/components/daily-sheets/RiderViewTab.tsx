import { useState } from "react";
import { useDailySheets, RoastingScheduleItem } from "@/hooks/useSchedules";
import { useRidersQuery } from "@/hooks/useRiders";
import { useUpdateOrderRiders } from "@/hooks/useLogistics";
import { InlineScheduleEditorModal } from "./InlineScheduleEditorModal";
import { InlineRiderSelect, SplitRiderButton } from "./InlineRiderSelect";
import { RiderAssignmentDialog } from "@/components/ui/orders/RiderAssignmentDialog";
import { Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  generateDispatchNotification,
  TemplateOrderData,
} from "@/utils/messengerTemplates";
import { sanitizeFreebiesSummary } from "@/utils/freebiesHelper";
import { sanitizeMojibake } from "@/utils/sanitizeDisplayText";
import { WalkInBadge } from "@/components/WalkInBadge";
import { isWalkInOrder } from "@/utils/walkIn";
import { groupRiderRoster } from "@/utils/dispatchRoster";
import { backupRiderLabel, namedRider } from "@/utils/splitMoto";

interface RiderViewTabProps {
  mode?: "edit" | "clean";
  selectedDate?: string;
  canEdit?: boolean;
  canAssignRiders?: boolean;
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

// Formatting helper for Philippine Peso (no decimals to save horizontal space)
const formatPHP = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatWeightDisplay = (weight?: string | null): string => {
  if (!weight) return "-";
  return weight
    .replace(/\s*kg\b/gi, "")
    .replace(/\.00\b/g, "")
    .replace(/\.0\b/g, "")
    .trim() || "-";
};

export function RiderViewTab({ mode = "edit", selectedDate, canEdit = true, canAssignRiders = canEdit }: RiderViewTabProps) {
  const { data: dailySheets, isLoading, isError } = useDailySheets(selectedDate);
  const [selectedItem, setSelectedItem] = useState<RoastingScheduleItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [riderOrderId, setRiderOrderId] = useState<number | null>(null);
  const { data: registeredRiders = [] } = useRidersQuery(mode === "edit");
  const updateOrderRiders = useUpdateOrderRiders();

  if (isLoading)
    return <div className="p-8 text-center text-muted-foreground font-medium">Loading logistics schedule...</div>;
  if (isError)
    return <div className="p-8 text-center text-red-500 font-medium">Failed to load logistics schedule.</div>;
  const allOrders = groupRiderRoster(dailySheets?.items ?? []);

  if (allOrders.length === 0)
    return <div className="p-8 text-center text-muted-foreground">No deliveries scheduled for the selected date.</div>;

  // Sort chronologically by Departure / Pickup Time for the Riders
  const sortedByDelivery = [...allOrders].sort((a, b) => {
    const timeA = new Date(a.riderDepartureTime ?? a.targetDeliveryTime).getTime();
    const timeB = new Date(b.riderDepartureTime ?? b.targetDeliveryTime).getTime();
    return timeA - timeB;
  });

  const handleCellClick = (item: RoastingScheduleItem) => {
    if (mode === "clean" || !canEdit) return;
    setSelectedItem(item);
    setIsEditorOpen(true);
  };

  const isCleanView = mode === "clean";
  const isEdit = !isCleanView && canEdit;
  const registeredOptions = [
    { name: "", label: "Unassigned" },
    ...registeredRiders.filter((rider) => rider.isActive).map((rider) => ({ name: rider.fullName })),
  ];

  const handleCopyDispatch = (item: (typeof allOrders)[number]) => {
    const matchedRider = registeredRiders.find(
      (r) => r.fullName.toLowerCase() === item.riderName?.trim().toLowerCase()
    );

    const price = Number(item.lechonPrice ?? item.price) || 0;
    const addOns = Number(item.addOnsTotal) || 0;
    const deliveryFee = Number(item.deliveryFee) || 0;
    const amountToCollect = Number(item.totalToCollect) || 0;

    const orderData: TemplateOrderData = {
      orderNumber: item.orderId || item.id,
      customerName: item.customerName || "Customer",
      targetDeliveryTime: item.targetDeliveryTime,
      fulfillment: item.fulfillment ?? 1,
      deliveryAddress: item.location || "",
      landmark: item.landmark || undefined,
      items: item.lines,
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
    return acc + (Number(item.totalToCollect) || 0);
  }, 0);

  return (
    <div className="space-y-3 w-full">
      {/* 100% Zero-Scroll Table Container */}
      <div className={`w-full overflow-x-auto rounded-md border-2 border-black ${mode === "clean" ? "no-scrollbar" : ""} print:overflow-visible bg-white shadow-xs`}>
        <table className={`w-full table-fixed border-collapse text-left text-xs ${mode === "clean" ? "min-w-[960px]" : "min-w-[1100px]"}`}>
          {/* Proportional Column Allocation: Total = 100%, No Horizontal Overflow */}
          <colgroup>
            <col className="w-[8%] min-w-[115px]" />{/* 1. No. */}
            <col className="w-[4.5%]" />{/* 2. Size (Compact: fits "S. Jumbo") */}
            <col className="w-[4.5%]" />{/* 3. Weight */}
            <col className="w-[10%] min-w-[104px]" />{/* 4. Departure / Pickup Time */}
            <col className="w-[9.5%]" />{/* 5. Customer Name */}
            <col className="w-[13%]" />{/* 6. Location */}
            <col className="w-[14%]" />{/* 7. Rider Name */}
            <col className="w-[12.5%]" />{/* 8. Remarks */}
            <col className="w-[4.5%]" />{/* 9. Price */}
            <col className="w-[3.5%]" />{/* 10. Add-ons */}
            <col className="w-[4%]" />{/* 11. Delivery Fee */}
            <col className="w-[4.5%]" />{/* 12. Down Payment */}
            <col className="w-[8%]" />{/* 13. Amount to Collect */}
          </colgroup>

          {/* High-Contrast Bold Table Header */}
          <thead className="bg-black text-white">
            <tr className="border-b-2 border-black">
              <th className="px-2 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 min-w-[120px] whitespace-nowrap font-mono font-bold">No.</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700 whitespace-nowrap">Size</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Weight</th>
              <th scope="col" className="min-w-[104px] whitespace-normal px-1.5 py-2.5 text-center font-black uppercase leading-tight text-[11px] border-r border-slate-700 bg-red-950 text-red-300">Departure /<br />Pickup</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Customer</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Location</th>
              <th className="px-1.5 py-2.5 text-center font-black uppercase text-[11px] border-r border-slate-700">Rider</th>
              <th className="px-1.5 py-2.5 text-left font-black uppercase text-[11px] border-r border-slate-700">Remarks</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Price</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Add-ons</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Del Fee</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] border-r border-slate-700">Down Payment</th>
              <th className="px-1.5 py-2.5 text-right font-black uppercase text-[11px] bg-slate-900 text-green-300">
                To Collect
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-300 bg-white">
            {sortedByDelivery.map((item) => {
              const freebiesSummary = sanitizeFreebiesSummary(item.freebiesSummary);
              const sanitizedRemarks = sanitizeMojibake(item.remarks);
              const price = Number(item.lechonPrice ?? item.price) || 0;
              const addOns = Number(item.addOnsTotal) || 0;
              const deliveryFee = Number(item.deliveryFee) || 0;
              const downpayment = Number(item.downpayment) || 0;
              const amountToCollect = Number(item.totalToCollect) || 0;
              const isWalkIn = isWalkInOrder(item);
              const needsDpConfirmation =
                downpayment === 0 &&
                !item.isTrustedCustomer &&
                amountToCollect > 0;

              const isStorePickup =
                item.fulfillment === 0 ||
                item.fulfillmentType === "Pickup" ||
                item.fulfillmentType === 0 ||
                item.deliveryMethod === "Pickup" ||
                item.deliveryMethod === "Store Pickup" ||
                item.riderName === "Store Pickup";

              const isLalamove =
                item.fulfillment === 2 ||
                item.fulfillmentType === "Lalamove" ||
                item.fulfillmentType === 2 ||
                item.deliveryMethod === "Lalamove" ||
                item.deliveryMethod === "Lalamove Courier" ||
                item.riderName === "Lalamove" ||
                item.riderName === "Lalamove Courier";

              const editableCellClass = isEdit
                ? "cursor-pointer transition-colors hover:bg-amber-100/70 group"
                : "";
              const lead = namedRider(item.riderName);
              const backupLabel = backupRiderLabel(item);
              const orderId = item.orderId;
              const reference = item.orderReference || String(orderId ?? item.id);
              const canEditAssignment = !isCleanView && canAssignRiders && !isStorePickup && !isLalamove;
              const openOrderRiders = () => setRiderOrderId(orderId ?? null);

              return (
                <tr
                  key={item.orderId ?? item.orderReference ?? item.id}
                  className={`${needsDpConfirmation ? "bg-amber-50 border-l-4 border-l-amber-500" : isWalkIn && isEdit ? "bg-indigo-50/40" : "even:bg-slate-50 odd:bg-white"} text-slate-900 hover:bg-amber-50/40`}
                >
                  {/* 1. No. */}
                  <td className="px-2 py-2 text-center text-slate-800 border-r border-slate-300 text-xs min-w-[120px] whitespace-nowrap font-mono font-bold">
                    #{item.orderReference || item.orderId || item.id}
                  </td>

                  {/* 2. Size (Compact & Centered: fits "S. Jumbo" without wrapping) */}
                  <td className="px-1.5 py-2 text-center font-bold text-slate-800 border-r border-slate-300 max-w-[85px] overflow-hidden break-words whitespace-normal leading-tight text-xs">
                    {item.lines.map((line, index) => (
                      <div key={index}>
                        {line.quantity > 1 && <span className="font-black">{line.quantity}x </span>}
                        {/lamang-loob|raw innards/i.test(line.categoryName) ? (
                          <>Raw Innards<span className="block text-[10px] font-normal text-stone-500">(Lamang-Loob)</span></>
                        ) : line.categoryName}
                      </div>
                    ))}
                  </td>

                  {/* 3. Weight */}
                  <td className="px-1.5 py-2 text-center font-medium text-slate-700 border-r border-slate-300 whitespace-nowrap text-[11px]">
                    {item.lines.map((line, index) => <div key={index}>{formatWeightDisplay(line.weight)}</div>)}
                  </td>

                  {/* 4. Departure / Pickup Time (Anti-Complacency Guard: ONLY shows RiderDepartureTime ?? TargetDeliveryTime) */}
                  <td className="min-w-[96px] px-3 py-2.5 text-center font-mono font-black text-red-600 text-xs sm:text-[13px] border-r border-slate-300 whitespace-nowrap">
                    {item.isTimeTbd || (!item.riderDepartureTime && !item.targetDeliveryTime) ? (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded text-[10.5px] whitespace-nowrap inline-flex items-center justify-center leading-none">
                        ⏳ Time TBD
                      </span>
                    ) : (
                      formatTime(item.riderDepartureTime ?? item.targetDeliveryTime)
                    )}
                  </td>

                  {/* 5. Customer Name */}
                  <td className="px-1.5 py-2 font-bold text-slate-900 border-r border-slate-300 break-words leading-tight">
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{item.customerName || "-"}</span>
                      <WalkInBadge
                        source={item.source}
                        customerName={item.customerName}
                        facebookName={item.facebookName}
                        clean={isCleanView}
                      />
                      {needsDpConfirmation && (
                        <span className="rounded border border-amber-500 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-950">
                          [⚠️ NO DP - CONFIRM FIRST]
                        </span>
                      )}
                    </div>
                    {item.facebookName &&
                      item.facebookName.toLocaleLowerCase() !== item.customerName?.toLocaleLowerCase() && (
                        <div className="mt-0.5 text-[9px] font-semibold text-slate-500">
                          {item.facebookName}
                        </div>
                      )}
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
                  <td className="px-1 py-2 text-center text-[11px] font-bold border-r border-slate-300">
                    <div className="flex min-w-0 flex-col items-center gap-1">
                      {isStorePickup ? (
                        <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-900">🏪 Store Pickup</span>
                      ) : isLalamove ? (
                        <span className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 font-bold text-orange-900">📦 Lalamove</span>
                      ) : canEditAssignment && orderId && !backupLabel ? (
                        <InlineRiderSelect
                          label={`Assign or change rider for order ${reference}`}
                          current={lead}
                          options={registeredOptions}
                          disabled={updateOrderRiders.isPending && updateOrderRiders.variables?.orderId === orderId}
                          editLabel="⚙️ Split / Custom Rider..."
                          onEditOrder={openOrderRiders}
                          onSelect={(name) => updateOrderRiders.mutateAsync({ orderId, riderName: name })}
                        />
                      ) : <span className={lead ? "break-words" : "font-normal italic text-slate-500"}>{lead || "Unassigned"}{backupLabel && lead ? " · Lead" : ""}</span>}
                      {backupLabel && !isStorePickup && !isLalamove && <span className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] leading-tight text-amber-950">{backupLabel}</span>}
                      {canEditAssignment && orderId && (backupLabel || item.wholeLechonQty > 2) && (
                        <SplitRiderButton hasSupport={Boolean(backupLabel)} reference={reference} onClick={openOrderRiders} />
                      )}
                      {!isCleanView && (lead || isStorePickup || isLalamove) && (
                        <button type="button" className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-700 hover:bg-blue-100 print:hidden" title="Copy Messenger Alert" onClick={() => handleCopyDispatch(item)}>
                          <Copy className="h-2.5 w-2.5" />
                          {isStorePickup ? "Pickup Alert" : isLalamove ? "Lalamove Alert" : "Dispatch Alert"}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* 8. Remarks (Wrap naturally without truncation!) */}
                  <td
                    onClick={() => handleCellClick(item)}
                    className={`px-1.5 py-2 text-slate-800 border-r border-slate-300 text-[10.5px] sm:text-[11px] font-medium leading-tight break-words ${editableCellClass}`}
                    title={[freebiesSummary, sanitizedRemarks].filter(Boolean).join(" • ") || undefined}
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
                        <span className="block break-words">{sanitizedRemarks || "-"}</span>
                      </div>
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

                  {/* 12. Down Payment */}
                  <td className={`px-1.5 py-2 text-right font-bold border-r border-slate-300 whitespace-nowrap text-[11px] ${downpayment > 0 ? "text-amber-700 bg-amber-50/50" : "text-slate-700"}`}>
                    {downpayment > 0 ? `-${formatPHP(downpayment)}` : formatPHP(0)}
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
              <td colSpan={5} className="px-3 py-2.5 text-left font-black uppercase tracking-wider border-r border-slate-300">
                Total Deliveries: {sortedByDelivery.length}
              </td>
              <td colSpan={4} className="px-3 py-2.5 text-left font-bold border-r border-slate-300">
                Logistics Dispatch Manifest
              </td>
              <td colSpan={4} className="px-3 py-2.5 text-right font-black text-green-800 text-xs sm:text-[13px] uppercase">
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
      {riderOrderId && <RiderAssignmentDialog orderId={riderOrderId} onClose={() => setRiderOrderId(null)} />}
    </div>
  );
}

export default RiderViewTab;
