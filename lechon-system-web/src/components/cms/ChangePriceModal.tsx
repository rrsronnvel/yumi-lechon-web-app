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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Adjust Base Price
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update catalogue rate for{" "}
            <span className="font-semibold text-slate-800">{category.name}</span>
            {isRoast
              ? ` (${category.minimumWeightKg}kg - ${category.maximumWeightKg}kg)`
              : " (Add-On)"}
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Current Price vs New Price Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                Current Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-slate-400 font-semibold">
                  ₱
                </span>
                <Input
                  type="text"
                  readOnly
                  value={currentPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                  className="pl-7 bg-slate-100 font-medium text-slate-700 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800">
                New Price (₱)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-slate-500 font-semibold">
                  ₱
                </span>
                <Input
                  type="number"
                  step="50"
                  min="1"
                  placeholder="0.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="pl-7 font-bold text-slate-900 focus-visible:ring-orange-500"
                  autoFocus
                />
              </div>
            </div>
          </div>

          {/* Live Diff Preview */}
          {isChanged && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Net Adjustment:
              </span>
              <Badge
                variant="outline"
                className={
                  diff > 0
                    ? "bg-amber-50 text-amber-800 border-amber-300 font-semibold"
                    : "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
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
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200/90 text-amber-900 flex gap-2.5 items-start">
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updatePriceMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-orange-600 hover:bg-orange-700 text-white"
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
