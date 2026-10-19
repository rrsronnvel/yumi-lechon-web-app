/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdjustStock } from "@/hooks/useInventory";
import { useMenuCategories } from "@/hooks/useCms";
import {
  adjustmentSchema,
  type AdjustmentFormValues,
} from "@/schemas/inventorySchema";
import { Scale } from "lucide-react";

export interface AdjustLedgerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdjustLedgerModal({
  open,
  onOpenChange,
}: AdjustLedgerModalProps) {
  const adjustStockMutation = useAdjustStock();
  const { data: categories = [], isLoading: isCategoriesLoading } =
    useMenuCategories();

  const pigCategories = useMemo(
    () =>
      categories.filter(
        (cat) =>
          cat.isActive !== false &&
          (cat.minimumWeightKg > 0 || cat.maximumWeightKg > 0)
      ),
    [categories]
  );

  const categoryItems = useMemo(() => {
    const items: Record<string, string> = {};
    pigCategories.forEach((cat) => {
      items[String(cat.id)] = `${cat.name} (${cat.minimumWeightKg.toFixed(1)}–${cat.maximumWeightKg.toFixed(1)} kg)`;
    });
    return items;
  }, [pigCategories]);

  const movementTypeItems: Record<string, string> = {
    StockIn: "📥 Stock In (+)",
    StockOut: "📤 Stock Out (-)",
    Adjustment: "⚖️ Shrinkage / Manual Adjustment (-)",
  };

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema) as any,
    defaultValues: {
      itemCategoryId: 0,
      quantity: 1,
      transactionType: "StockIn",
      reason: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        itemCategoryId: 0,
        quantity: 1,
        transactionType: "StockIn",
        reason: "",
      });
    }
  }, [open, form]);

  const onSubmitAdjustment = (data: AdjustmentFormValues) => {
    adjustStockMutation.mutate(
      {
        itemCategoryId: data.itemCategoryId,
        quantity: data.quantity,
        transactionType: data.transactionType,
        reason: data.reason,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset({
            itemCategoryId: 0,
            quantity: 1,
            transactionType: "StockIn",
            reason: "",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-x-hidden sm:max-w-md w-full p-6 rounded-xl border-stone-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-600" />
            Adjust Ledger Balance
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Record manual inventory adjustments, shrinkage, or physical recount corrections.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((data) => onSubmitAdjustment(data))}
          className="space-y-4 pt-2"
        >
          {/* Dynamic Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Weight Bracket / Category <span className="text-rose-500">*</span>
            </label>
            <Select
              items={categoryItems}
              value={
                form.watch("itemCategoryId")
                  ? String(form.watch("itemCategoryId"))
                  : ""
              }
              onValueChange={(val: string | null) => {
                if (val) {
                  form.setValue("itemCategoryId", Number(val), {
                    shouldValidate: true,
                  });
                }
              }}
            >
              <SelectTrigger className="w-full h-10 border-stone-300 bg-white">
                <SelectValue
                  placeholder={
                    isCategoriesLoading
                      ? "Loading categories..."
                      : "Select category / weight bracket..."
                  }
                >
                  {(val: any) => (val ? categoryItems[String(val)] || val : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pigCategories.map((category) => (
                  <SelectItem
                    key={category.id}
                    value={String(category.id)}
                  >
                    {category.name} ({category.minimumWeightKg.toFixed(1)}–{category.maximumWeightKg.toFixed(1)} kg)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.itemCategoryId && (
              <p className="text-xs text-rose-600 font-medium">
                {form.formState.errors.itemCategoryId.message}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Quantity <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              min={1}
              className="h-10 border-stone-300 font-mono"
              {...form.register("quantity", { valueAsNumber: true })}
            />
            {form.formState.errors.quantity && (
              <p className="text-xs text-rose-600 font-medium">
                {form.formState.errors.quantity.message}
              </p>
            )}
          </div>

          {/* Transaction Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Movement Type <span className="text-rose-500">*</span>
            </label>
            <Select
              items={movementTypeItems}
              value={form.watch("transactionType")}
              onValueChange={(val: string | null) => {
                if (val) {
                  form.setValue(
                    "transactionType",
                    val as "StockIn" | "StockOut" | "Adjustment",
                    {
                      shouldValidate: true,
                    }
                  );
                }
              }}
            >
              <SelectTrigger className="w-full h-10 border-stone-300 bg-white">
                <SelectValue placeholder="Select type...">
                  {(val: any) => (val ? movementTypeItems[String(val)] || val : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="StockIn">📥 Stock In (+)</SelectItem>
                <SelectItem value="StockOut">📤 Stock Out (-)</SelectItem>
                <SelectItem value="Adjustment">
                  ⚖️ Shrinkage / Manual Adjustment (-)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason for Adjustment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Reason for Adjustment <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              className="h-10 border-stone-300"
              placeholder="e.g., Spoiled belly, physical count discrepancy..."
              {...form.register("reason")}
            />
            {form.formState.errors.reason && (
              <p className="text-xs text-rose-600 font-medium">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 bg-transparent border-t border-stone-200 pt-4 px-0 pb-0 flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 border-stone-300 text-stone-700"
              onClick={() => onOpenChange(false)}
              disabled={adjustStockMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors"
              disabled={adjustStockMutation.isPending}
            >
              {adjustStockMutation.isPending
                ? "Logging Adjustment..."
                : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
