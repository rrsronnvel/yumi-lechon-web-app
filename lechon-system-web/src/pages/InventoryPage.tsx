import { useState, useMemo } from "react";
import {
  useInventoryAlerts,
  useAdjustStock,
  useInventoryLedger,
  useInventoryBalances,
  type InventoryBalance,
  type InventoryAlert,
  type InventoryTransaction,
} from "../hooks/useInventory";
import { useMenuCategories } from "../hooks/useCms";
import ReceiveStockModal from "@/components/ui/inventory/ReceiveStockModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adjustmentSchema,
  type AdjustmentFormValues,
} from "../schemas/inventorySchema";

export default function InventoryPage() {
  // 1. Fetching Hooks
  const { data: alerts, isLoading: isAlertsLoading, isError: isAlertsError } = useInventoryAlerts();
  const adjustStockMutation = useAdjustStock();
  const { data: ledgerData, isLoading: isLedgerLoading } = useInventoryLedger();
  const { data: balances, isLoading: isBalancesLoading, isError: isBalancesError } = useInventoryBalances();
  const { data: categories = [], isLoading: isCategoriesLoading } = useMenuCategories();

  // Memoize pig categories (excluding non-pig add-ons) and human-readable label lookup map
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

  // 2. Local State & Form Validation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  const form = useForm<AdjustmentFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(adjustmentSchema) as any,
    defaultValues: {
      itemCategoryId: 0,
      quantity: 1,
      transactionType: "StockIn",
      reason: "",
    },
  });

  // 3. Handlers
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
          setIsModalOpen(false);
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

  const handleCopyProcurement = () => {
    if (!alerts || alerts.length === 0) return;

    const orderText = alerts
      .map(
        (item: InventoryAlert) =>
          `- ${item.minimumSafetyStock - item.currentStock}x ${
            item.categoryName || `Category #${item.itemCategoryId}`
          }`
      )
      .join("\n");

    const fullMessage = `Hi! We need to order the following pigs today:\n${orderText}\n\nThank you!`;

    navigator.clipboard.writeText(fullMessage).then(() => {
      alert("Order list copied to clipboard! You can now paste it into Messenger.");
    });
  };

  if (isBalancesLoading && isAlertsLoading) {
    return <div className="p-8 text-muted-foreground">Checking the freezer scoreboard...</div>;
  }

  if (isBalancesError || isAlertsError) {
    return (
      <div className="p-8 text-red-500">
        Error connecting to the inventory and ledger engine.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Inventory & Procurement
          </h1>
          <p className="text-sm text-muted-foreground">
            Dual-stock forecasting: track physical chest freezers vs. 14-day committed reservations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* FREEZER-GATE INTAKE */}
          <Button
            onClick={() => setIsReceiveModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            + Log Freezer Intake
          </Button>

          {/* THE OVERRIDE SWITCH (MODAL) */}
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            Manual Adjustment
          </Button>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adjust Ledger Balance</DialogTitle>
              </DialogHeader>

              <form
                onSubmit={form.handleSubmit((data) => onSubmitAdjustment(data))}
                className="space-y-4 pt-4"
              >
                {/* Dynamic Category Selector */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Weight Bracket / Category <span className="text-red-500">*</span>
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
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          isCategoriesLoading
                            ? "Loading categories..."
                            : "Select category / weight bracket..."
                        }
                      >
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                    <p className="text-sm text-red-500">
                      {form.formState.errors.itemCategoryId.message}
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    {...form.register("quantity", { valueAsNumber: true })}
                  />
                  {form.formState.errors.quantity && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.quantity.message}
                    </p>
                  )}
                </div>

                {/* Transaction Type */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Movement Type <span className="text-red-500">*</span>
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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type...">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                  <label className="text-sm font-medium text-slate-700">
                    Reason for Adjustment <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., Spoiled belly, physical count discrepancy..."
                    {...form.register("reason")}
                  />
                  {form.formState.errors.reason && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.reason.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={adjustStockMutation.isPending}
                >
                  {adjustStockMutation.isPending
                    ? "Logging Adjustment..."
                    : "Confirm Adjustment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* FREEZER-GATE INTAKE MODAL */}
          <ReceiveStockModal
            open={isReceiveModalOpen}
            onOpenChange={setIsReceiveModalOpen}
          />
        </div>
      </div>

      {/* THE DASHBOARD DISPLAY */}
      <Tabs defaultValue="balances" className="w-full">
        {/* Navigation Tabs */}
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="balances">Live Balances</TabsTrigger>
          <TabsTrigger value="ledger">Audit Ledger</TabsTrigger>
          <TabsTrigger value="procurement">Procurement</TabsTrigger>
        </TabsList>

        {/* Tab 1: Live Balances (6-Column Scoreboard) */}
        <TabsContent value="balances">
          <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-semibold">Weight Bracket</TableHead>
                  <TableHead className="text-right font-semibold">
                    Physical (On-Hand)
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Locked (14d)
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Available
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Safety Level
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isBalancesLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground h-28"
                    >
                      Calculating dual-stock balances...
                    </TableCell>
                  </TableRow>
                ) : !balances || balances.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground h-28"
                    >
                      No categories found in the database.
                    </TableCell>
                  </TableRow>
                ) : (
                  balances.map((item: InventoryBalance) => (
                    <TableRow key={item.categoryId} className="hover:bg-slate-50/50">
                      {/* Column 1: Weight Bracket */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 font-semibold">
                            {item.categoryName || `Category #${item.categoryId}`}
                          </span>
                          {item.weightRangeDisplay && (
                            <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {item.weightRangeDisplay}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Column 2: Physical (On-Hand) */}
                      <TableCell className="text-right font-mono font-medium text-slate-800">
                        {item.physicalStock}
                      </TableCell>

                      {/* Column 3: Locked (14d) */}
                      <TableCell className="text-right font-mono text-slate-600">
                        {item.lockedStock}
                      </TableCell>

                      {/* Column 4: Available */}
                      <TableCell className="text-right font-mono font-bold">
                        <span
                          className={
                            item.availableStock < 0
                              ? "text-red-600"
                              : item.availableStock <= item.minimumSafetyStock
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }
                        >
                          {item.availableStock}
                        </span>
                      </TableCell>

                      {/* Column 5: Safety Level */}
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.minimumSafetyStock}
                      </TableCell>

                      {/* Column 6: Status */}
                      <TableCell className="text-center">
                        {item.healthStatus === "Optimal" ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                          >
                            Optimal
                          </Badge>
                        ) : item.healthStatus === "Low Stock" ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 font-medium"
                          >
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 border-red-200 font-medium"
                          >
                            Deficit
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Audit Ledger */}
        <TabsContent value="ledger">
          <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="text-right font-semibold">Quantity</TableHead>
                  <TableHead className="font-semibold">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLedgerLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-28 text-muted-foreground"
                    >
                      Loading ledger records...
                    </TableCell>
                  </TableRow>
                ) : !ledgerData || ledgerData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-28 text-muted-foreground"
                    >
                      No transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerData.map((tx: InventoryTransaction) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-700">
                        {new Date(tx.transactionDate).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.transactionType === "StockIn"
                              ? "default"
                              : tx.transactionType === "Adjustment"
                              ? "outline"
                              : "destructive"
                          }
                          className={
                            tx.transactionType === "Adjustment"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : ""
                          }
                        >
                          {tx.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {tx.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground italic">
                        {tx.reason || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 3: Procurement */}
        <TabsContent value="procurement">
          <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Supplier Order Draft
                </h3>
                <p className="text-sm text-muted-foreground">
                  Review restock deficits calculated against minimum safety levels.
                </p>
              </div>
              <Button
                onClick={handleCopyProcurement}
                disabled={!alerts || alerts.length === 0}
              >
                Copy for Messenger
              </Button>
            </div>

            {/* The Text List */}
            <div className="bg-muted/30 p-4 rounded-md font-mono text-sm whitespace-pre-wrap border border-slate-100">
              {!alerts || alerts.length === 0 ? (
                <span className="text-muted-foreground italic">
                  No items currently require restocking.
                </span>
              ) : (
                <>
                  <p>Hi! We need to order the following pigs today:</p>
                  <br />
                  {alerts.map((item: InventoryAlert) => (
                    <p key={item.itemCategoryId}>
                      - {item.minimumSafetyStock - item.currentStock}x{" "}
                      {item.categoryName || `Category #${item.itemCategoryId}`}
                    </p>
                  ))}
                  <br />
                  <p>Thank you!</p>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
