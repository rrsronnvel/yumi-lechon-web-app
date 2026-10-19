import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdatePrice, ItemCategory } from "@/hooks/useCms";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface ChangePriceModalProps {
  category: ItemCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePriceModal({
  category,
  open,
  onOpenChange,
}: ChangePriceModalProps) {
  const [newPrice, setNewPrice] = useState<string>("");
  const updatePriceMutation = useUpdatePrice();

  useEffect(() => {
    if (category && open) {
      setNewPrice(category.basePrice.toString());
    } else {
      setNewPrice("");
    }
  }, [category, open]);

  if (!category) return null;

  const currentPrice = category.basePrice;
  const numericNewPrice = parseFloat(newPrice);
  const isValidNumber = !isNaN(numericNewPrice) && numericNewPrice > 0;
  const isChanged = isValidNumber && numericNewPrice !== currentPrice;
  const diff = isValidNumber ? numericNewPrice - currentPrice : 0;
  const isRoast = category.minimumWeightKg > 0;
  const isPriceHike = isRoast && diff > 0;

  const handleSave = () => {
    if (!isChanged || !isValidNumber) return;

    updatePriceMutation.mutate(
      {
        categoryId: category.id,
        newPrice: numericNewPrice,
        adminName: "Owner",
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-x-hidden sm:max-w-[440px] w-full p-6 rounded-xl border-stone-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-stone-900">
            Adjust Base Price
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Update catalogue rate for{" "}
            <span className="font-semibold text-stone-800">{category.name}</span>
            {isRoast
              ? ` (${category.minimumWeightKg}kg - ${category.maximumWeightKg}kg)`
              : " (Add-On)"}
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Price vs New Price Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600">
                Current Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-stone-400 font-semibold">
                  ₱
                </span>
                <Input
                  type="text"
                  readOnly
                  value={currentPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                  className="h-10 pl-7 bg-stone-100 border-stone-200 font-medium text-stone-700 font-mono cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-800">
                New Price (₱)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-stone-500 font-semibold">
                  ₱
                </span>
                <Input
                  type="number"
                  step="50"
                  min="1"
                  placeholder="0.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="h-10 pl-7 font-bold font-mono text-stone-900 border-stone-300 focus-visible:ring-[#C81E1E]"
                  autoFocus
                />
              </div>
            </div>
          </div>

          {/* Live Diff Preview */}
          {isChanged && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <span className="text-xs font-medium text-stone-600">
                Net Adjustment:
              </span>
              <Badge
                variant="outline"
                className={
                  diff > 0
                    ? "bg-amber-50 text-amber-800 border-amber-300 font-semibold font-mono"
                    : "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold font-mono"
                }
              >
                {diff > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 mr-1 text-amber-600" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                )}
                {diff > 0 ? "+" : ""}₱
                {diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          )}

          {/* Peak Season Warning Banner */}
          {isPriceHike && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold">Peak Season Warning</p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Heads up: Increasing this base roast price will trigger a dashboard
                  renegotiation review for advance bookings made at the older rate.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 bg-transparent border-t border-stone-200 pt-4 px-0 pb-0 flex flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 border-stone-300 text-stone-700"
            onClick={() => onOpenChange(false)}
            disabled={updatePriceMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors"
            onClick={handleSave}
            disabled={!isChanged || !isValidNumber || updatePriceMutation.isPending}
          >
            {updatePriceMutation.isPending ? "Updating Price..." : "Save New Price"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
