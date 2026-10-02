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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Edit Category Specification
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure catalog metadata, weight classification, and safety buffer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Item Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Item Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Medium Whole Lechon"
              className="focus-visible:ring-orange-500"
            />
          </div>

          {/* Weight Bracket (Roasts only, disabled on Add-ons) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Weight Classification Bracket (kg)
              </label>
              {isAddOn && (
                <span className="text-[11px] text-muted-foreground italic">
                  Non-meat add-on (0 kg locked)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">
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
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "focus-visible:ring-orange-500"
                  }
                />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium">
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
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "focus-visible:ring-orange-500"
                  }
                />
              </div>
            </div>
          </div>

          {/* Safety Stock */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Minimum Safety Stock Buffer (heads)
              </label>
              {isAddOn && (
                <span className="text-[11px] text-muted-foreground italic">
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
                  ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                  : "focus-visible:ring-orange-500"
              }
            />
            <p className="text-[11px] text-muted-foreground">
              {isAddOn
                ? "Add-ons, sauces, and drinks do not occupy freezer slots."
                : "Freezer alert threshold before triggering restock notifications."}
            </p>
          </div>

          {/* Non-Meat Exclusion Shield Badge for Add-Ons */}
          {isAddOn && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 flex gap-2.5 items-center">
              <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-xs">
                <strong>Non-Meat Exclusion Shield:</strong> This item is classified as an
                add-on and automatically bypasses the roasting schedule and freezer reservation ledger.
              </p>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex gap-2 items-center text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateDetailsMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-orange-600 hover:bg-orange-700 text-white"
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
