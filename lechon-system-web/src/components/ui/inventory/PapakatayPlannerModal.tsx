import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useButcherPlan, type ButcherPlanItem } from "@/hooks/useInventory";
import { getPhilippineDateString } from "@/utils/dateNormalizer";
import { toast } from "sonner";
import {
  Copy,
  Plus,
  Minus,
  Trash2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export interface PapakatayPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CustomRow {
  id: string;
  weightLabel: string;
  quantity: number;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export default function PapakatayPlannerModal({
  open,
  onOpenChange,
}: PapakatayPlannerModalProps) {
  const todayStr = useMemo(() => getPhilippineDateString(), []);

  // Default preset: Next 3 Days (Tomorrow to +3 Days)
  const defaultStart = useMemo(() => addDays(todayStr, 1), [todayStr]);
  const defaultEnd = useMemo(() => addDays(todayStr, 3), [todayStr]);

  const [activePreset, setActivePreset] = useState<
    "tomorrow" | "next2" | "next3" | "next7" | "custom"
  >("next3");

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // Fetch plan from backend
  const { data: planData, isLoading, isError, refetch } = useButcherPlan(
    startDate,
    endDate
  );

  // Final editable quantities per categoryId
  const [editableQtys, setEditableQtys] = useState<Record<number, number>>({});
  // Custom VIP weight rows
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  // Include size labels toggle (UNCHECKED by default)
  const [includeSizeLabels, setIncludeSizeLabels] = useState(false);

  // Synchronize initial quantities when backend plan data arrives or date changes
  useEffect(() => {
    if (planData?.items) {
      const initial: Record<number, number> = {};
      planData.items.forEach((item) => {
        initial[item.categoryId] = item.suggestedSlaughterCount;
      });
      setEditableQtys(initial);
    }
  }, [planData]);

  // Quick Preset Handlers
  const applyPreset = (preset: "tomorrow" | "next2" | "next3" | "next7") => {
    setActivePreset(preset);
    const start = addDays(todayStr, 1);
    let end = start;
    if (preset === "tomorrow") {
      end = start;
    } else if (preset === "next2") {
      end = addDays(todayStr, 2);
    } else if (preset === "next3") {
      end = addDays(todayStr, 3);
    } else if (preset === "next7") {
      end = addDays(todayStr, 7);
    }
    setStartDate(start);
    setEndDate(end);
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setActivePreset("custom");
    setStartDate(start);
    setEndDate(end);
  };

  // Stepper handlers
  const updateQty = (catId: number, delta: number) => {
    setEditableQtys((prev) => ({
      ...prev,
      [catId]: Math.max(0, (prev[catId] ?? 0) + delta),
    }));
  };

  const setDirectQty = (catId: number, val: number) => {
    setEditableQtys((prev) => ({
      ...prev,
      [catId]: Math.max(0, isNaN(val) ? 0 : val),
    }));
  };

  // Reset / Prefill options
  const handlePreFillSuggested = () => {
    if (!planData?.items) return;
    const next: Record<number, number> = {};
    planData.items.forEach((item) => {
      next[item.categoryId] = item.suggestedSlaughterCount;
    });
    setEditableQtys(next);
    toast.info("Reset to Net Shortage quantities.");
  };

  const handlePreFillBooked = () => {
    if (!planData?.items) return;
    const next: Record<number, number> = {};
    planData.items.forEach((item) => {
      next[item.categoryId] = item.upcomingOrdersCount;
    });
    setEditableQtys(next);
    toast.info("Filled with Total Booked order quantities.");
  };

  // Custom row handlers
  const handleAddCustomRow = () => {
    setCustomRows((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        weightLabel: "50kg",
        quantity: 1,
      },
    ]);
  };

  const updateCustomRow = (
    id: string,
    field: "weightLabel" | "quantity",
    value: string | number
  ) => {
    setCustomRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]:
                field === "quantity"
                  ? Math.max(0, Number(value) || 0)
                  : String(value),
            }
          : row
      )
    );
  };

  const removeCustomRow = (id: string) => {
    setCustomRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Dynamic calculations
  const totalHeads = useMemo(() => {
    let sum = 0;
    Object.values(editableQtys).forEach((q) => {
      sum += q;
    });
    customRows.forEach((r) => {
      sum += r.quantity;
    });
    return sum;
  }, [editableQtys, customRows]);

  // Generated Text for Butcher Message
  const generatedMessage = useMemo(() => {
    if (!planData) return "";

    const lines: string[] = [];

    planData.items.forEach((cat) => {
      const qty = editableQtys[cat.categoryId] ?? 0;
      if (qty > 0) {
        if (includeSizeLabels) {
          lines.push(`• ${qty}x ${cat.categoryName} (${cat.weightBracket})`);
        } else {
          lines.push(`• ${qty}x ${cat.weightBracket}`);
        }
      }
    });

    customRows.forEach((row) => {
      if (row.quantity > 0 && row.weightLabel.trim()) {
        lines.push(`• ${row.quantity}x ${row.weightLabel.trim()}`);
      }
    });

    const dateLabel = planData.dateRangeLabel || `${startDate} to ${endDate}`;

    return [
      `🔪 PAPAKATAY LIST (${dateLabel})`,
      "",
      ...lines,
      "",
      `Total: ${totalHeads} head${totalHeads === 1 ? "" : "s"}`,
    ].join("\n");
  }, [planData, editableQtys, customRows, includeSizeLabels, totalHeads, startDate, endDate]);

  const handleCopy = () => {
    if (totalHeads <= 0) {
      toast.warning("No pigs scheduled for slaughter. Please specify at least 1 head.");
      return;
    }

    navigator.clipboard.writeText(generatedMessage).then(() => {
      toast.success("Papakatay list copied! Ready to paste into butcher's chat.");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-w-5xl sm:max-w-5xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] flex flex-col p-0 bg-white border border-stone-300 shadow-2xl rounded-2xl overflow-hidden gap-0"
        style={{ maxWidth: "min(1150px, 96vw)" }}
      >
        {/* COMPACT DIALOG HEADER */}
        <DialogHeader className="px-5 py-3.5 border-b border-stone-200 shrink-0 bg-stone-50/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🔪</span>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                    Papakatay Planner
                  </DialogTitle>
                  <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] py-0.5">
                    Procurement &amp; Slaughter
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-stone-500 mt-0.5 line-clamp-1">
                  Calculate butcher slaughter targets based on upcoming Whole Lechon bookings vs. current freezer stock.
                </DialogDescription>
              </div>
            </div>
            <div className="text-right pr-7 shrink-0">
              <div className="text-[11px] font-semibold uppercase text-stone-500 tracking-wider">Slaughter Total</div>
              <div className="text-xl sm:text-2xl font-black text-amber-700 leading-none">
                {totalHeads} <span className="text-xs font-semibold text-stone-500">heads</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3">
          {/* 1. DATE PRESET & WINDOW BAR (STREAMLINED 1-ROW LAYOUT) */}
          <div className="bg-stone-50 p-2.5 sm:px-3 sm:py-2 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-2">
            {/* Presets & Active Window */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5 shrink-0 mr-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Window:</span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={activePreset === "tomorrow" ? "default" : "outline"}
                  onClick={() => applyPreset("tomorrow")}
                  className={`h-7 px-2.5 text-xs font-bold cursor-pointer ${
                    activePreset === "tomorrow"
                      ? "bg-amber-700 text-white hover:bg-amber-800"
                      : "border-stone-300 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activePreset === "next2" ? "default" : "outline"}
                  onClick={() => applyPreset("next2")}
                  className={`h-7 px-2.5 text-xs font-bold cursor-pointer ${
                    activePreset === "next2"
                      ? "bg-amber-700 text-white hover:bg-amber-800"
                      : "border-stone-300 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  Next 2 Days
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activePreset === "next3" ? "default" : "outline"}
                  onClick={() => applyPreset("next3")}
                  className={`h-7 px-2.5 text-xs font-bold cursor-pointer ${
                    activePreset === "next3"
                      ? "bg-amber-700 text-white hover:bg-amber-800"
                      : "border-stone-300 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  Next 3 Days
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activePreset === "next7" ? "default" : "outline"}
                  onClick={() => applyPreset("next7")}
                  className={`h-7 px-2.5 text-xs font-bold cursor-pointer ${
                    activePreset === "next7"
                      ? "bg-amber-700 text-white hover:bg-amber-800"
                      : "border-stone-300 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  Next 7 Days
                </Button>
              </div>
              <span className="text-xs font-semibold text-stone-800 bg-white px-2.5 py-1 rounded border border-stone-200 shadow-2xs ml-1">
                {planData?.dateRangeLabel || `${startDate} - ${endDate}`}
              </span>
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-stone-500 font-medium shrink-0">Custom:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
                className="h-7 w-32 text-xs bg-white"
              />
              <span className="text-stone-400">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
                className="h-7 w-32 text-xs bg-white"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-7 px-2 text-stone-600 hover:text-stone-900 cursor-pointer"
                title="Refresh plan"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* 2. SUMMARY SCOREBOARD (4 COLUMNS IN 1 ROW ON DESKTOP) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-center">
              <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Upcoming Orders</div>
              <div className="text-xl font-black text-blue-800 mt-0.5">
                {planData?.totalUpcomingOrders ?? 0}
              </div>
              <div className="text-[10px] text-blue-600">Whole lechons booked</div>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Freezer Stock</div>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {planData?.totalAvailableFreezerStock ?? 0}
              </div>
              <div className="text-[10px] text-slate-500">Pigs currently on-hand</div>
            </div>
            <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-lg text-center">
              <div className="text-[11px] font-bold text-rose-900 uppercase tracking-wide">Net Shortage</div>
              <div className="text-xl font-black text-rose-700 mt-0.5">
                {planData?.totalSuggestedSlaughter ?? 0}
              </div>
              <div className="text-[10px] text-rose-600">Calculated deficit</div>
            </div>
            <div className="p-2.5 bg-amber-50/70 border border-amber-300 rounded-lg text-center">
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Final Papakatay</div>
              <div className="text-xl font-black text-amber-800 mt-0.5">
                {totalHeads}
              </div>
              <div className="text-[10px] text-amber-700">Adjusted butcher list</div>
            </div>
          </div>

          {/* PLANNING TABLE CONTROLS & TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
              <span className="font-bold text-stone-900">Planning Table:</span>
              <span className="text-[11px] font-normal text-stone-500">
                Adjust quantities as needed (+1 / +2 for rush order buffers)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomRow}
                className="h-7 px-2.5 text-xs font-semibold text-purple-700 border-purple-300 hover:bg-purple-50 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom Weight</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreFillSuggested}
                className="h-7 px-2.5 text-xs font-semibold text-stone-700 border-stone-300 hover:bg-stone-100 cursor-pointer"
              >
                Reset to Net Shortage
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreFillBooked}
                className="h-7 px-2.5 text-xs font-semibold text-stone-700 border-stone-300 hover:bg-stone-100 cursor-pointer"
              >
                Fill with Total Booked
              </Button>
            </div>
          </div>

          {/* 3. INTERACTIVE PLANNING TABLE (SPACIOUS, NO-WRAPPING DESKTOP PROPORTIONS) */}
          <div className="rounded-lg border border-stone-300 bg-white max-h-[46vh] overflow-y-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="bg-stone-100 sticky top-0 z-10 border-b border-stone-300 text-stone-700 uppercase font-bold tracking-wider text-[11px]">
                <tr>
                  <th className="px-3.5 py-2">SIZE &amp; WEIGHT BRACKET</th>
                  <th className="px-2.5 py-2 text-center">UPCOMING ORDERS</th>
                  <th className="px-2.5 py-2 text-center">CURRENT FREEZER STOCK</th>
                  <th className="px-2.5 py-2 text-center">NET SHORTAGE</th>
                  <th className="px-3 py-2 text-center">FINAL PAPAKATAY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-stone-500">
                      Calculating upcoming order requirements and freezer inventory...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-rose-600 font-semibold">
                      Failed to load butcher plan. Please try again.
                    </td>
                  </tr>
                ) : planData?.items?.length ? (
                  planData.items.map((cat: ButcherPlanItem) => {
                    const qty = editableQtys[cat.categoryId] ?? cat.suggestedSlaughterCount;
                    const isShortage = cat.suggestedSlaughterCount > 0;
                    const hasCustom = cat.customWeights && cat.customWeights.length > 0;

                    return (
                      <tr
                        key={cat.categoryId}
                        className={`hover:bg-amber-50/40 transition-colors ${
                          qty > 0 ? "bg-amber-50/25" : ""
                        }`}
                      >
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-stone-900 text-xs sm:text-sm">
                              {cat.categoryName}
                            </span>
                            <span className="text-stone-500 font-medium text-xs">
                              ({cat.weightBracket})
                            </span>
                            {hasCustom && (
                              <div className="flex flex-wrap gap-1">
                                {cat.customWeights.map((cw, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    VIP: {cw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-center font-bold text-stone-800">
                          {cat.upcomingOrdersCount > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-xs">
                              {cat.upcomingOrdersCount} booked
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">0</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-center font-medium text-stone-700">
                          {cat.availableFreezerStock > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs">
                              {cat.availableFreezerStock} in stock
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">0</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-center font-bold">
                          {isShortage ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-xs">
                              <AlertCircle className="w-3 h-3" />
                              {cat.suggestedSlaughterCount} needed
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-xs">
                              0 (Covered)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => updateQty(cat.categoryId, -1)}
                              disabled={qty <= 0}
                              className="h-7 w-7 rounded border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={qty}
                              onChange={(e) =>
                                setDirectQty(cat.categoryId, parseInt(e.target.value, 10))
                              }
                              className="h-7 w-14 text-center font-black text-xs sm:text-sm bg-white"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => updateQty(cat.categoryId, 1)}
                              className="h-7 w-7 rounded border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-stone-500">
                      No Whole Lechon categories found.
                    </td>
                  </tr>
                )}

                {/* CUSTOM VIP WEIGHT ROWS */}
                {customRows.map((row) => (
                  <tr key={row.id} className="bg-purple-50/30">
                    <td className="px-3.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-700 font-bold text-xs shrink-0">VIP / Custom:</span>
                        <Input
                          type="text"
                          value={row.weightLabel}
                          placeholder="e.g. 50kg"
                          onChange={(e) =>
                            updateCustomRow(row.id, "weightLabel", e.target.value)
                          }
                          className="h-7 w-28 text-xs bg-white border-purple-300 font-medium"
                        />
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-center text-stone-400 text-xs">—</td>
                    <td className="px-2.5 py-2 text-center text-stone-400 text-xs">—</td>
                    <td className="px-2.5 py-2 text-center text-stone-400 text-xs">Custom</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateCustomRow(row.id, "quantity", row.quantity - 1)
                          }
                          disabled={row.quantity <= 0}
                          className="h-7 w-7 rounded border-stone-300 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={row.quantity}
                          onChange={(e) =>
                            updateCustomRow(
                              row.id,
                              "quantity",
                              parseInt(e.target.value, 10)
                            )
                          }
                          className="h-7 w-14 text-center font-black text-xs sm:text-sm bg-white"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            updateCustomRow(row.id, "quantity", row.quantity + 1)
                          }
                          className="h-7 w-7 rounded border-stone-300 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomRow(row.id)}
                          className="h-7 w-7 text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Remove custom weight"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. COMPACT PREVIEW GENERATOR */}
          <div className="bg-stone-900 text-stone-100 p-2.5 sm:p-3 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>💬</span>
                <span>Butcher Chat Message Preview</span>
              </span>
              <span className="text-[10.5px] text-stone-400">
                * Default formats weight brackets only (e.g. 3x 20-21kg) without size names.
              </span>
            </div>

            <pre className="font-mono text-xs text-stone-200 whitespace-pre-wrap bg-stone-950 p-2.5 rounded-lg border border-stone-800 max-h-24 overflow-y-auto leading-relaxed">
              {generatedMessage || "No pigs selected for slaughter yet."}
            </pre>
          </div>
        </div>

        {/* 5. STICKY FOOTER CONTROLS */}
        <div className="bg-stone-100 border-t border-stone-200 px-5 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-xs text-stone-600">
              Slaughter Total:{" "}
              <strong className="text-sm sm:text-base font-black text-amber-800">
                {totalHeads} head{totalHeads === 1 ? "" : "s"}
              </strong>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-stone-700 select-none">
              <input
                type="checkbox"
                checked={includeSizeLabels}
                onChange={(e) => setIncludeSizeLabels(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span>Include size labels (e.g. XL - 3x 28-30kg)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 px-4 border-stone-300 text-stone-700 hover:bg-stone-200 text-xs font-semibold cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleCopy}
              disabled={totalHeads <= 0}
              className="h-8 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>📋 Copy Papakatay List ({totalHeads} heads)</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
