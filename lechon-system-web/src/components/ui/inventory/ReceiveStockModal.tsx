/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useReceiveStockMutation,
  useInventoryBalances,
} from "@/hooks/useInventory";
import { useMenuCategories, type ItemCategory } from "@/hooks/useCms";
import {
  Warehouse,
  Plus,
  Minus,
  Trash2,
  Loader2,
  PackageCheck,
  TrendingUp,
} from "lucide-react";

export interface ReceiveStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface StagedIntakeItem {
  itemCategoryId: number;
  categoryName: string;
  quantity: number;
}

export default function ReceiveStockModal({
  open,
  onOpenChange,
}: ReceiveStockModalProps) {
  // 1. Data hooks
  const { data: categories = [], isLoading: isCategoriesLoading } =
    useMenuCategories();
  const { data: balances = [] } = useInventoryBalances();
  const receiveMutation = useReceiveStockMutation();

  // Filter for meat/pig categories (excluding non-meat add-ons)
  const meatCategories = useMemo(
    () =>
      categories.filter(
        (c: ItemCategory) =>
          c.isActive !== false &&
          (c.minimumWeightKg > 0 || c.maximumWeightKg > 0)
      ),
    [categories]
  );

  const categoryMap = useMemo(() => {
    const map = new Map<number, ItemCategory>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  const balanceMap = useMemo(() => {
    const map = new Map<number, number>();
    balances.forEach((bal) => map.set(bal.categoryId, bal.physicalStock));
    return map;
  }, [balances]);

  // 2. Local State
  const [items, setItems] = useState<StagedIntakeItem[]>([]);
  const [categoryToAdd, setCategoryToAdd] = useState<number | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState<number>(1);
  const [supplierDrNumber, setSupplierDrNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const resetForm = () => {
    setItems([]);
    setCategoryToAdd(null);
    setQuantityToAdd(1);
    setSupplierDrNumber("");
    setNotes("");
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Add Item to Staged Intake List
  const handleAddItem = () => {
    if (!categoryToAdd) {
      toast.error("Please select a carcass category first.");
      return;
    }
    if (quantityToAdd <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }

    const cat = categoryMap.get(categoryToAdd);
    const catName = cat?.name || `Category #${categoryToAdd}`;

    setItems((prev) => {
      const existing = prev.find((i) => i.itemCategoryId === categoryToAdd);
      if (existing) {
        return prev.map((i) =>
          i.itemCategoryId === categoryToAdd
            ? { ...i, quantity: i.quantity + quantityToAdd }
            : i
        );
      }
      return [
        ...prev,
        {
          itemCategoryId: categoryToAdd,
          categoryName: catName,
          quantity: quantityToAdd,
        },
      ];
    });

    setQuantityToAdd(1);
  };

  // Stepper handlers
  const handleUpdateQuantity = (itemCategoryId: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.itemCategoryId === itemCategoryId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const handleSetQuantity = (itemCategoryId: number, qty: number) => {
    const safeQty = isNaN(qty) || qty < 1 ? 1 : qty;
    setItems((prev) =>
      prev.map((item) =>
        item.itemCategoryId === itemCategoryId
          ? { ...item, quantity: safeQty }
          : item
      )
    );
  };

  const handleRemoveItem = (itemCategoryId: number) => {
    setItems((prev) =>
      prev.filter((item) => item.itemCategoryId !== itemCategoryId)
    );
  };

  // Dynamic button guard: total incoming carcasses
  const totalIncoming = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  // Submit Handler
  const handleSubmit = () => {
    if (totalIncoming === 0) {
      toast.error("No carcass items staged for intake.");
      return;
    }

    if (items.some((i) => i.quantity <= 0)) {
      toast.error("All items must have a quantity greater than zero.");
      return;
    }

    receiveMutation.mutate(
      {
        supplierDrNumber: supplierDrNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          itemCategoryId: i.itemCategoryId,
          quantity: i.quantity,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Stock intake committed to freezer ledger.");
          resetForm();
          onOpenChange(false);
        },
        onError: (err: any) => {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.Message ||
            "Failed to complete stock intake.";
          toast.error("Stock Intake Failed", { description: msg });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 rounded-xl border-stone-200">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-stone-900">
            <Warehouse className="w-5 h-5 text-emerald-600" />
            Freezer-Gate Stock Intake
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Log clean carcasses and bellies arriving at store chest freezers.
          </DialogDescription>
        </DialogHeader>

        {/* Item Intake Selection Section */}
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 space-y-3 mt-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Select Carcass or Belly to Receive
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-8 space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Weight Bracket / Category
              </label>
              <Select
                value={categoryToAdd ? String(categoryToAdd) : ""}
                onValueChange={(val: string | null) => {
                  if (val) setCategoryToAdd(Number(val));
                }}
              >
                <SelectTrigger className="w-full h-10 bg-white border-stone-300">
                  <SelectValue placeholder="Select category / bracket...">
                    {(val: any) => {
                      if (!val) return null;
                      const cat = categoryMap.get(Number(val));
                      return cat
                        ? `${cat.name} (${cat.minimumWeightKg.toFixed(
                            1
                          )}–${cat.maximumWeightKg.toFixed(1)} kg)`
                        : val;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {meatCategories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name} ({cat.minimumWeightKg.toFixed(1)}–
                      {cat.maximumWeightKg.toFixed(1)} kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Quantity
              </label>
              <Input
                type="number"
                min={1}
                className="h-10 bg-white border-stone-300 font-mono"
                value={quantityToAdd}
                onChange={(e) =>
                  setQuantityToAdd(Math.max(1, parseInt(e.target.value) || 1))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold"
                onClick={handleAddItem}
                disabled={isCategoriesLoading || !categoryToAdd}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
        </div>

        {/* Added Items List with Steppers and Remove Action */}
        {items.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                Staged Carcass Intake List
              </span>
              <span className="text-xs text-stone-500 font-mono">
                {items.length} line item{items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="border border-stone-200 rounded-xl divide-y divide-stone-200/70 overflow-hidden bg-white shadow-xs">
              {items.map((item) => {
                const cat = categoryMap.get(item.itemCategoryId);
                const weightRange =
                  cat && (cat.minimumWeightKg > 0 || cat.maximumWeightKg > 0)
                    ? `${cat.minimumWeightKg.toFixed(1)}–${cat.maximumWeightKg.toFixed(1)} kg`
                    : null;

                return (
                  <div
                    key={item.itemCategoryId}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900 text-sm">
                        {item.categoryName}
                      </span>
                      {weightRange && (
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs font-normal bg-stone-100 text-stone-700 border-stone-200"
                        >
                          {weightRange}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-stone-300 rounded-md overflow-hidden bg-stone-50">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-none text-stone-600 hover:bg-stone-200"
                          onClick={() =>
                            handleUpdateQuantity(item.itemCategoryId, -1)
                          }
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleSetQuantity(
                              item.itemCategoryId,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="h-8 w-14 text-center font-mono font-bold text-sm border-0 border-x border-stone-300 rounded-none bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-none text-stone-600 hover:bg-stone-200"
                          onClick={() =>
                            handleUpdateQuantity(item.itemCategoryId, 1)
                          }
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleRemoveItem(item.itemCategoryId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery Documentation Section (2-Column Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Supplier DR / Delivery Receipt #
            </label>
            <Input
              type="text"
              placeholder="e.g., DR-98241"
              value={supplierDrNumber}
              onChange={(e) => setSupplierDrNumber(e.target.value)}
              className="h-10 text-sm border-stone-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Operational Notes
            </label>
            <Input
              type="text"
              placeholder="e.g., Batangas batch, dressed by Kuya Bert"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 text-sm border-stone-300"
            />
          </div>
        </div>

        {/* Live Impact Verification Table */}
        {items.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-700">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Live Impact Verification
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100/70 text-stone-600 font-semibold uppercase tracking-wider text-xs border-b border-stone-200">
                    <TableHead className="font-semibold text-stone-600">Category</TableHead>
                    <TableHead className="text-right font-semibold text-stone-600">
                      Current On-Hand
                    </TableHead>
                    <TableHead className="text-right font-semibold text-stone-600">
                      Incoming (+)
                    </TableHead>
                    <TableHead className="text-right font-semibold text-stone-600">
                      Projected New Stock
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-stone-200/70">
                  {items.map((item) => {
                    const cat = categoryMap.get(item.itemCategoryId);
                    const currentOnHand = balanceMap.get(item.itemCategoryId) ?? 0;
                    const incomingQty = item.quantity;
                    const projectedStock = currentOnHand + incomingQty;

                    return (
                      <TableRow key={item.itemCategoryId} className="text-sm hover:bg-stone-50/70">
                        <TableCell className="font-medium text-stone-900">
                          {item.categoryName}
                          {cat && (cat.minimumWeightKg > 0 || cat.maximumWeightKg > 0) && (
                            <span className="ml-2 text-xs text-stone-500 font-mono">
                              ({cat.minimumWeightKg.toFixed(1)}–
                              {cat.maximumWeightKg.toFixed(1)} kg)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-stone-600">
                          {currentOnHand}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 font-semibold">
                          +{incomingQty}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-600">
                          {projectedStock}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Footer Action & Dynamic Button Guard */}
        <DialogFooter className="mx-0 mb-0 bg-transparent mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-stone-200 pt-4 px-0 pb-0">
          <div className="text-sm text-stone-600">
            Total Incoming Carcasses:{" "}
            <span className="font-bold text-stone-900 font-mono">
              {totalIncoming}
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 border-stone-300 text-stone-700"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={receiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={receiveMutation.isPending || totalIncoming === 0}
              className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              {receiveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Stocking Freezers...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Confirm Receiving & Stock Freezers
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
