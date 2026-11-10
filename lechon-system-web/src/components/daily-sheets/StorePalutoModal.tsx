/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  Clock,
  Utensils,
  ChefHat,
  RotateCcw,
  Check,
  Loader2,
  CalendarDays,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreatePrepRequestMutation } from "@/hooks/useFreebiesPrep";
import { normalizeDateInput } from "@/utils/dateNormalizer";

export interface StorePalutoModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  selectedDate?: string;
  targetDate?: string;
}

export type PrepCategory =
  | "Staff Meryenda"
  | "Owner / Family"
  | "VIP Gift"
  | "Store Buffer";

interface CategoryOption {
  id: PrepCategory;
  label: string;
  activeClass: string;
  inactiveClass: string;
  defaultPlaceholder: string;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: "Staff Meryenda",
    label: "👥 Staff Meryenda",
    activeClass: "bg-purple-700 text-white shadow-sm ring-2 ring-purple-300 border-purple-700",
    inactiveClass: "bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100",
    defaultPlaceholder: "e.g. Kitchen & Riders Afternoon Meryenda",
    description: "Kitchen crew & dispatch riders",
  },
  {
    id: "Owner / Family",
    label: "👑 Owner / Family",
    activeClass: "bg-amber-700 text-white shadow-sm ring-2 ring-amber-300 border-amber-700",
    inactiveClass: "bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100",
    defaultPlaceholder: "e.g. Boss Ronnie / Family Lunch",
    description: "Owner & family meals",
  },
  {
    id: "VIP Gift",
    label: "🎁 VIP Gift",
    activeClass: "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-300 border-emerald-700",
    inactiveClass: "bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100",
    defaultPlaceholder: "e.g. Mayor / VIP Partner Gift",
    description: "Complimentary VIP gift",
  },
  {
    id: "Store Buffer",
    label: "🏪 Store Buffer",
    activeClass: "bg-blue-700 text-white shadow-sm ring-2 ring-blue-300 border-blue-700",
    inactiveClass: "bg-blue-50 text-blue-950 border-blue-200 hover:bg-blue-100",
    defaultPlaceholder: "e.g. Store Counter Walk-in Reserve",
    description: "Counter walk-in reserve",
  },
];

interface PrepItemOption {
  key: string;
  name: string;
  unit: string;
  icon: string;
}

const PREP_ITEMS: PrepItemOption[] = [
  { key: "Pancit", name: "Pancit", unit: "Bilao", icon: "🍜" },
  { key: "Palabok", name: "Palabok", unit: "Bilao", icon: "🍝" },
  { key: "Spaghetti", name: "Spaghetti", unit: "Bilao", icon: "🍝" },
  { key: "Dinuguan", name: "Dinuguan", unit: "Tub", icon: "🍲" },
  { key: "Puto", name: "Puto", unit: "Pack", icon: "🥟" },
  { key: "Sarsa", name: "Sarsa", unit: "Bottle", icon: "🥣" },
  { key: "1.5L Coke", name: "1.5L Coke", unit: "Bottle", icon: "🥤" },
];

const TIME_PRESETS = [
  { time: "10:30", label: "10:30 AM" },
  { time: "11:30", label: "11:30 AM" },
  { time: "12:00", label: "12:00 PM" },
  { time: "15:00", label: "03:00 PM (Default)" },
  { time: "17:00", label: "05:00 PM" },
];

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-PH", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function StorePalutoModal({
  isOpen,
  open,
  onClose,
  onOpenChange,
  selectedDate,
  targetDate,
}: StorePalutoModalProps) {
  const isModalOpen = open ?? isOpen ?? false;
  const activeDate = targetDate ?? selectedDate ?? "";

  const handleModalClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const [category, setCategory] = useState<PrepCategory>("Staff Meryenda");
  const [recipient, setRecipient] = useState<string>("");
  const [timeNeeded, setTimeNeeded] = useState<string>("15:00");
  const [remarks, setRemarks] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => ({
    Pancit: 0,
    Palabok: 0,
    Spaghetti: 0,
    Dinuguan: 0,
    Puto: 0,
    Sarsa: 0,
    "1.5L Coke": 0,
  }));

  const createMutation = useCreatePrepRequestMutation();

  const currentCategoryConfig = useMemo(() => {
    return CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  }, [category]);

  const totalItemsCount = useMemo(() => {
    return Object.values(quantities).reduce((acc, q) => acc + q, 0);
  }, [quantities]);

  const activeItemsSummary = useMemo(() => {
    return Object.entries(quantities)
      .filter(([_, q]) => q > 0)
      .map(([k, q]) => `${q}x ${k}`);
  }, [quantities]);

  const handleIncrement = (itemKey: string, step = 1) => {
    setQuantities((prev) => ({
      ...prev,
      [itemKey]: (prev[itemKey] || 0) + step,
    }));
  };

  const handleDecrement = (itemKey: string, step = 1) => {
    setQuantities((prev) => ({
      ...prev,
      [itemKey]: Math.max(0, (prev[itemKey] || 0) - step),
    }));
  };

  const handleDirectQuantity = (itemKey: string, val: string) => {
    const parsed = parseInt(val, 10);
    setQuantities((prev) => ({
      ...prev,
      [itemKey]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  };

  const handleResetAllItems = () => {
    setQuantities({
      Pancit: 0,
      Palabok: 0,
      Spaghetti: 0,
      Dinuguan: 0,
      Puto: 0,
      Sarsa: 0,
      "1.5L Coke": 0,
    });
  };

  const resetForm = () => {
    setCategory("Staff Meryenda");
    setRecipient("");
    setTimeNeeded("15:00");
    handleResetAllItems();
    setRemarks("");
  };

  useEffect(() => {
    if (!isModalOpen) {
      resetForm();
    }
  }, [isModalOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedRecipient = recipient.trim();
    if (!trimmedRecipient) {
      toast.error("Validation Error", {
        description: "Please specify a recipient or purpose label.",
      });
      return;
    }

    if (totalItemsCount <= 0) {
      toast.warning("No Items Selected", {
        description: "Please specify at least 1 item to prepare using the steppers.",
      });
      return;
    }

    if (!timeNeeded) {
      toast.error("Validation Error", {
        description: "Please select the time needed for this prep request.",
      });
      return;
    }

    const normalizedDate = normalizeDateInput(activeDate);
    const [hh, mm] = timeNeeded.split(":");
    const targetTimeIso = `${normalizedDate}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`;

    const activeItemsDict: Record<string, number> = {};
    Object.entries(quantities).forEach(([k, v]) => {
      if (v > 0) activeItemsDict[k] = v;
    });

    createMutation.mutate(
      {
        targetDate: normalizedDate,
        targetTime: targetTimeIso,
        category,
        recipientOrLabel: trimmedRecipient,
        items: activeItemsDict,
        remarks: remarks.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          toast.success("Store Paluto Request Added! 🍲", {
            description: `${data.recipientOrLabel} (${data.category}) scheduled for ${data.targetTimeDisplay || timeNeeded}.`,
          });
          resetForm();
          handleModalClose();
        },
        onError: (err: any) => {
          const errorMsg =
            err?.response?.data?.message ||
            err?.response?.data?.title ||
            err?.message ||
            "Failed to save Store Paluto request.";
          toast.error("Request Failed", {
            description: errorMsg,
          });
        },
      }
    );
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(isOpenVal) => { if (!isOpenVal) handleModalClose(); }}>
      <DialogContent
        className="w-[96vw] max-w-3xl sm:max-w-3xl lg:max-w-3xl max-h-[90vh] flex flex-col p-0 bg-white border border-stone-300 shadow-2xl rounded-2xl overflow-hidden gap-0"
        style={{ maxWidth: "min(780px, 96vw)" }}
      >
        {/* MODAL HEADER WITH GENEROUS RIGHT PADDING FOR CLOSE BUTTON */}
        <DialogHeader className="px-6 py-4 border-b border-stone-200 shrink-0 bg-stone-50/80 pr-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl select-none">🍲</span>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>Add Store Paluto / Extra Kitchen Prep</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-stone-500 mt-0.5">
                  Internal food prep for crew meryenda, family meals, VIP gifts, or store buffer.
                </DialogDescription>
              </div>
            </div>
            {activeDate && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg shrink-0 shadow-2xs">
                <CalendarDays className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-xs font-bold text-amber-900">
                  {formatDisplayDate(activeDate)}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 text-stone-900">
          {/* 1. CATEGORY PILL SELECTOR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                1. Select Category *
              </Label>
              <span className="text-[11px] font-normal text-stone-500">
                Categorizes request for kitchen packaging
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center",
                      isSelected
                        ? cat.activeClass
                        : cn(cat.inactiveClass)
                    )}
                  >
                    <span className="text-xs sm:text-sm font-black">{cat.label}</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium mt-0.5 truncate w-full",
                        isSelected ? "text-white/90" : "text-stone-500"
                      )}
                    >
                      {cat.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. RECIPIENT / LABEL INPUT */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="paluto-recipient" className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                2. Recipient / Purpose Label *
              </Label>
              <span className="text-[10px] text-stone-400 font-mono">
                {recipient.length} / 150
              </span>
            </div>
            <Input
              id="paluto-recipient"
              type="text"
              maxLength={150}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={currentCategoryConfig.defaultPlaceholder}
              className="h-10 text-sm bg-white border-stone-300 rounded-lg focus-visible:ring-amber-500"
              required
            />
          </div>

          {/* 3. TIME NEEDED PICKER WITH HARMONIZED PRESETS */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="paluto-time" className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>3. Time Needed (Kitchen Preparation Anchor) *</span>
              </Label>
              <span className="text-[11px] text-amber-800 font-semibold">Target Serving: {timeNeeded}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Input
                id="paluto-time"
                type="time"
                value={timeNeeded}
                onChange={(e) => setTimeNeeded(e.target.value)}
                className="h-10 w-full sm:w-36 text-sm font-mono font-bold bg-white border-stone-300 text-stone-900 rounded-lg shrink-0"
                required
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {TIME_PRESETS.map((p) => (
                  <button
                    key={p.time}
                    type="button"
                    onClick={() => setTimeNeeded(p.time)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap",
                      timeNeeded === p.time
                        ? "bg-amber-100 border-amber-400 text-amber-950 font-bold shadow-2xs"
                        : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. ITEM STEPPERS (BALANCED 2-COLUMN GRID + FULL-WIDTH COKE ROW) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-stone-500" />
                <span>4. Items to Cook &amp; Pack (Steppers) *</span>
              </Label>
              <div className="flex items-center gap-2">
                {totalItemsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllItems}
                    className="text-[11px] font-semibold text-stone-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset All</span>
                  </button>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-bold px-2.5 py-0.5 rounded-full transition-colors",
                    totalItemsCount > 0
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-stone-50 text-stone-500 border-stone-200"
                  )}
                >
                  {totalItemsCount} total item{totalItemsCount === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:p-3.5 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Items 1 to 6 (Paired in 2 columns) */}
                {PREP_ITEMS.filter((i) => i.key !== "1.5L Coke").map((item) => {
                  const qty = quantities[item.key] || 0;
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "flex items-center justify-between p-2.5 sm:px-3 sm:py-2.5 rounded-xl border transition-all bg-white shadow-2xs",
                        qty > 0
                          ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-300"
                          : "border-stone-200 hover:border-stone-300"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0 select-none">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-stone-500 font-medium">
                            Unit: {item.unit}
                          </div>
                        </div>
                      </div>

                      {/* STEPPER BUTTONS */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleDecrement(item.key)}
                          disabled={qty <= 0}
                          className="h-8 w-8 rounded-lg border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) => handleDirectQuantity(item.key, e.target.value)}
                          className="h-8 w-12 text-center font-black text-xs sm:text-sm bg-white p-0 border-stone-300 rounded-md"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleIncrement(item.key)}
                          className="h-8 w-8 rounded-lg border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Item 7: 1.5L Coke (Full Width spanning 2 columns with quick presets) */}
                {(() => {
                  const cokeItem = PREP_ITEMS.find((i) => i.key === "1.5L Coke")!;
                  const cokeQty = quantities["1.5L Coke"] || 0;
                  return (
                    <div
                      key={cokeItem.key}
                      className={cn(
                        "sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:px-3 sm:py-2.5 rounded-xl border transition-all bg-white shadow-2xs gap-2.5",
                        cokeQty > 0
                          ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-300"
                          : "border-stone-200 hover:border-stone-300"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0 select-none">{cokeItem.icon}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                            {cokeItem.name}
                          </div>
                          <div className="text-[11px] text-stone-500 font-medium">
                            Unit: Bottle (1.5 Liters)
                          </div>
                        </div>
                        {/* Quick Presets for Coke */}
                        <div className="hidden sm:flex items-center gap-1 ml-4 border-l border-stone-200 pl-4">
                          <span className="text-[10px] text-stone-400 font-medium mr-1">Quick:</span>
                          <button
                            type="button"
                            onClick={() => handleIncrement("1.5L Coke", 1)}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 hover:bg-amber-100 border border-stone-200 text-stone-700 hover:text-amber-900 cursor-pointer"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIncrement("1.5L Coke", 2)}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 hover:bg-amber-100 border border-stone-200 text-stone-700 hover:text-amber-900 cursor-pointer"
                          >
                            +2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIncrement("1.5L Coke", 4)}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 hover:bg-amber-100 border border-stone-200 text-stone-700 hover:text-amber-900 cursor-pointer"
                          >
                            +4 (Belly Swap)
                          </button>
                        </div>
                      </div>

                      {/* STEPPER CONTROLS */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleDecrement("1.5L Coke")}
                          disabled={cokeQty <= 0}
                          className="h-8 w-8 rounded-lg border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={cokeQty}
                          onChange={(e) => handleDirectQuantity("1.5L Coke", e.target.value)}
                          className="h-8 w-12 text-center font-black text-xs sm:text-sm bg-white p-0 border-stone-300 rounded-md"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleIncrement("1.5L Coke")}
                          className="h-8 w-8 rounded-lg border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ACTIVE SELECTION SUMMARY PILLS */}
              {totalItemsCount > 0 && (
                <div className="pt-2 border-t border-stone-200/80 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-stone-700">Kitchen Checklist:</span>
                  {activeItemsSummary.map((summaryText, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                    >
                      <Check className="w-3 h-3 text-amber-800" />
                      {summaryText}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. KITCHEN NOTE / REMARKS OPTIONAL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="paluto-remarks" className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                5. Kitchen Note / Remarks (Optional)
              </Label>
              <span className="text-[10px] text-stone-400 font-mono">
                {remarks.length} / 500
              </span>
            </div>
            <Textarea
              id="paluto-remarks"
              maxLength={500}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Cook fresh before 3:00 PM, separate sauce bottles, pack with meryenda utensils..."
              className="min-h-[64px] text-sm bg-white border-stone-300 rounded-lg resize-none focus-visible:ring-amber-500"
              rows={2}
            />
          </div>
        </div>

        {/* MODAL FOOTER WITH COMFORTABLE BOTTOM PADDING */}
        <div className="bg-stone-50 border-t border-stone-200 px-6 py-4.5 sm:px-6 sm:py-5 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Internal prep: does not create customer revenue or affect drawer cash.</span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleModalClose}
              disabled={createMutation.isPending}
              className="text-xs h-9 px-4 rounded-lg cursor-pointer font-semibold border-stone-300 hover:bg-stone-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit()}
              disabled={createMutation.isPending || totalItemsCount <= 0 || !recipient.trim()}
              className="text-xs h-9 px-4 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Adding Request...</span>
                </>
              ) : (
                <>
                  <ChefHat className="w-3.5 h-3.5 mr-1" />
                  <span>Add Store Paluto ({totalItemsCount} item{totalItemsCount === 1 ? "" : "s"})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StorePalutoModal;
