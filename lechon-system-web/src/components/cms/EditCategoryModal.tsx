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
import { useUpdateCategoryDetails, ItemCategory } from "@/hooks/useCms";
import { AlertCircle, ShieldAlert } from "lucide-react";

interface EditCategoryModalProps {
  category: ItemCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCategoryModal({
  category,
  open,
  onOpenChange,
}: EditCategoryModalProps) {
  const [name, setName] = useState("");
  const [minWeight, setMinWeight] = useState<string>("0");
  const [maxWeight, setMaxWeight] = useState<string>("0");
  const [safetyStock, setSafetyStock] = useState<string>("0");

  const updateDetailsMutation = useUpdateCategoryDetails();

  useEffect(() => {
    if (category && open) {
      setName(category.name);
      setMinWeight(category.minimumWeightKg.toString());
      setMaxWeight(category.maximumWeightKg.toString());
      setSafetyStock((category.minimumSafetyStock ?? 0).toString());
    }
  }, [category, open]);

  if (!category) return null;

  const isAddOn = category.minimumWeightKg === 0;
  const numMinWeight = parseFloat(minWeight) || 0;
  const numMaxWeight = parseFloat(maxWeight) || 0;
  const numSafetyStock = parseInt(safetyStock, 10) || 0;

  // Form Validations
  let validationError: string | null = null;
  if (!name.trim()) {
    validationError = "Category name is required.";
  } else if (!isAddOn) {
    if (numMinWeight < 0) {
      validationError = "Minimum weight cannot be negative.";
    } else if (numMinWeight >= numMaxWeight) {
      validationError = "Minimum weight must be strictly less than maximum weight.";
    } else if (numSafetyStock < 0) {
      validationError = "Minimum safety stock cannot be negative.";
    }
  }

  const isFormValid = validationError === null;

  const handleSave = () => {
    if (!isFormValid) return;

    updateDetailsMutation.mutate(
      {
        categoryId: category.id,
        name: name.trim(),
        minimumWeightKg: isAddOn ? 0 : numMinWeight,
        maximumWeightKg: isAddOn ? 0 : numMaxWeight,
        minimumSafetyStock: isAddOn ? 0 : numSafetyStock,
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
      <DialogContent className="overflow-x-hidden sm:max-w-[480px] w-full p-6 rounded-xl border-stone-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-stone-900">
            Edit Category Specification
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Configure catalog metadata, weight classification, and safety buffer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Item Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Item Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Medium Whole Lechon"
              className="h-10 border-stone-300 focus-visible:ring-[#C81E1E]"
            />
          </div>

          {/* Weight Bracket (Roasts only, disabled on Add-ons) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700">
                Weight Classification Bracket (kg)
              </label>
              {isAddOn && (
                <span className="text-[11px] text-stone-500 italic">
                  Non-meat add-on (0 kg locked)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] text-stone-500 font-medium">
                  Min Weight (kg)
                </span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={isAddOn}
                  value={isAddOn ? "0" : minWeight}
                  onChange={(e) => setMinWeight(e.target.value)}
                  className={
                    isAddOn
                      ? "h-10 bg-stone-100 border-stone-200 text-stone-500 font-mono cursor-not-allowed"
                      : "h-10 border-stone-300 font-mono focus-visible:ring-[#C81E1E]"
                  }
                />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-stone-500 font-medium">
                  Max Weight (kg)
                </span>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={isAddOn}
                  value={isAddOn ? "0" : maxWeight}
                  onChange={(e) => setMaxWeight(e.target.value)}
                  className={
                    isAddOn
                      ? "h-10 bg-stone-100 border-stone-200 text-stone-500 font-mono cursor-not-allowed"
                      : "h-10 border-stone-300 font-mono focus-visible:ring-[#C81E1E]"
                  }
                />
              </div>
            </div>
          </div>

          {/* Safety Stock */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700">
                Minimum Safety Stock Buffer (heads)
              </label>
              {isAddOn && (
                <span className="text-[11px] text-stone-500 italic">
                  Excluded from freezer tracking
                </span>
              )}
            </div>
            <Input
              type="number"
              step="1"
              min="0"
              disabled={isAddOn}
              value={isAddOn ? "0" : safetyStock}
              onChange={(e) => setSafetyStock(e.target.value)}
              className={
                isAddOn
                  ? "h-10 bg-stone-100 border-stone-200 text-stone-500 font-mono cursor-not-allowed"
                  : "h-10 border-stone-300 font-mono focus-visible:ring-[#C81E1E]"
              }
            />
            <p className="text-[11px] text-stone-500">
              {isAddOn
                ? "Add-ons, sauces, and drinks do not occupy freezer slots."
                : "Freezer alert threshold before triggering restock notifications."}
            </p>
          </div>

          {/* Non-Meat Exclusion Shield Badge for Add-Ons */}
          {isAddOn && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 flex gap-2.5 items-center">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs">
                <strong>Non-Meat Exclusion Shield:</strong> This item is classified as an
                add-on and automatically bypasses the roasting schedule and freezer reservation ledger.
              </p>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex gap-2 items-center text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 bg-transparent border-t border-stone-200 pt-4 px-0 pb-0 flex flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 border-stone-300 text-stone-700"
            onClick={() => onOpenChange(false)}
            disabled={updateDetailsMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors"
            onClick={handleSave}
            disabled={!isFormValid || updateDetailsMutation.isPending}
          >
            {updateDetailsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
