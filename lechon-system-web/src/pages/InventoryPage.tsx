/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import {
  useInventoryAlerts,
  useGeneratePOs,
  useAdjustStock,
  useInventoryLedger,
  useInventoryBalances,
} from "../hooks/useInventory";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adjustmentSchema,
  type AdjustmentFormValues,
} from "../schemas/inventorySchema";

interface InventoryAlert {
  itemCategoryId: number;
  categoryName: string;
  currentStock: number;
  minimumSafetyStock: number;
}

interface InventoryTransaction {
  id: number;
  transactionDate: string;
  transactionType: string;
  quantity: number;
  reason: string;
}

export default function InventoryPage() {
  // 1. Fetching Hooks
  const { data: alerts, isLoading, isError } = useInventoryAlerts();
  const generatePOsMutation = useGeneratePOs();
  const adjustStockMutation = useAdjustStock();
  const { data: ledgerData, isLoading: isLedgerLoading } = useInventoryLedger();
  const { data: balances, isLoading: isBalancesLoading } = useInventoryBalances();

  // 2. Local State & Form Validation
  const [isModalOpen, setIsModalOpen] = useState(false);

 const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema) as any,
    defaultValues: {
      itemCategoryId: 0,
      quantity: 0,
      transactionType: "StockIn",
      reason: "", 
    },
  });

  // 3. Handlers
  const handleGeneratePO = () => {
    generatePOsMutation.mutate();
  };

  const onSubmitAdjustment = (data: AdjustmentFormValues) => {
    adjustStockMutation.mutate({
      itemCategoryId: data.itemCategoryId,
      quantity: data.quantity,
      transactionType: data.transactionType,
      reason: data.reason, // Pass the reason to the C# Backend!
    });
    setIsModalOpen(false);
    form.reset(); // Clear the form for next time
  };

  const handleCopyProcurement = () => {
    // 1. Check if we actually have items to order
    if (!alerts || alerts.length === 0) return;

    // 2. Format the array of data into a nice text message
    const orderText = alerts
      .map((item: InventoryAlert) => `- ${item.minimumSafetyStock - item.currentStock}x ${item.categoryName || `Category #${item.itemCategoryId}`}`)
      .join("\n");

    const fullMessage = `Hi! We need to order the following pigs today:\n${orderText}\n\nThank you!`;

    // 3. Use the browser's built-in clipboard API
    navigator.clipboard.writeText(fullMessage).then(() => {
      alert("Order list copied to clipboard! You can now paste it into Messenger.");
    });
  };

  

  if (isLoading) return <div className="p-8">Checking the freezer...</div>;
  if (isError)
    return (
      <div className="p-8 text-red-500">Error connecting to the ledger.</div>
    );

  return (
    <div className="p-8 space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Inventory & Procurement
        </h1>

        <div className="flex space-x-4">
          {/* THE OVERRIDE SWITCH (MODAL) */}
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            Manual Adjustment
          </Button>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            {/* We brought DialogContent back to hold the form! */}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adjust Ledger Balance</DialogTitle>
              </DialogHeader>

              {/* Wrapped the submit handler in an inline function to silence TS */}
              <form
                onSubmit={form.handleSubmit((data) => onSubmitAdjustment(data))}
                className="space-y-4 pt-4"
              >
                <div>
                  <label className="text-sm font-medium">
                    Category ID (Weight Bracket)
                  </label>
                  <Input type="number" {...form.register("itemCategoryId")} />
                  {form.formState.errors.itemCategoryId && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.itemCategoryId.message as string}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input type="number" {...form.register("quantity")} />
                  {form.formState.errors.quantity && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.quantity.message as string}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    {...form.register("transactionType")}
                  >
                    <option value="StockIn">Stock In (+)</option>
                    <option value="StockOut">Stock Out (-)</option>
                    <option value="Adjustment">Shrinkage/Adjustment (-)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Reason for Adjustment
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., Spoiled belly, manual recount..."
                    {...form.register("reason")}
                  />
                  {form.formState.errors.reason && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.reason.message as string}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full">
                  Confirm Adjustment
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* THE AUTO-ORDER BUTTON */}
          <Button
            onClick={handleGeneratePO}
            disabled={generatePOsMutation.isPending}
          >
            {generatePOsMutation.isPending
              ? "Generating..."
              : "Generate Draft POs"}
          </Button>
        </div>
      </div>

      {/* THE DASHBOARD DISPLAY */}
      <Tabs defaultValue="balances" className="w-full">
        {/* The Navigation Buttons */}
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="balances">Live Balances</TabsTrigger>
          <TabsTrigger value="ledger">Audit Ledger</TabsTrigger>
          <TabsTrigger value="procurement">Procurement</TabsTrigger>
        </TabsList>

        {/* Room 1: Live Balances (Your existing table) */}
        <TabsContent value="balances">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Weight Bracket</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Minimum Safety Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isBalancesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                      Loading freezer counts...
                    </TableCell>
                  </TableRow>
                ) : !balances || balances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                      No categories found in the database.
                    </TableCell>
                  </TableRow>
                ) : (
                  balances.map((item: any) => (
                    // FIX 1: Use the exact 'id' from your JSON for the React key
                    <TableRow key={item.id}>
                      
                      <TableCell className="font-medium">
                        {/* FIX 2: Use the exact 'name' from your JSON */}
                        {item.name || `Category #${item.id}`}
                      </TableCell>
                      
                      {/* Note: We added a fallback '|| 0' because your raw category JSON doesn't calculate the live stock yet! */}
                      <TableCell>{item.currentStock || 0}</TableCell>
                      
                      <TableCell>{item.minimumSafetyStock}</TableCell>
                      
                      <TableCell>
                        {(item.currentStock || 0) <= item.minimumSafetyStock ? (
                          <Badge variant="destructive">Low Stock</Badge>
                        ) : (
                          <Badge variant="secondary">Stable</Badge>
                        )}
                      </TableCell>
                      
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Room 2: Audit Ledger */}
        <TabsContent value="ledger">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLedgerLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-24 text-muted-foreground"
                    >
                      Loading ledger records...
                    </TableCell>
                  </TableRow>
                ) : !ledgerData || ledgerData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-24 text-muted-foreground"
                    >
                      No transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerData.map((tx: InventoryTransaction) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">
                        {new Date(tx.transactionDate).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {/* Color-code the badge based on what kind of transaction it is! */}
                        <Badge
                          variant={
                            tx.transactionType === "StockIn"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {tx.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell>{tx.quantity}</TableCell>
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

        {/* Room 3: Procurement */}
        <TabsContent value="procurement">
          <div className="border rounded-md p-6 bg-white space-y-4">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="text-lg font-semibold">Supplier Order Draft</h3>
                <p className="text-sm text-muted-foreground">
                  Review the required restock amounts based on your minimum safety levels.
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
            <div className="bg-muted/30 p-4 rounded-md font-mono text-sm whitespace-pre-wrap">
              {!alerts || alerts.length === 0 ? (
                <span className="text-muted-foreground italic">No items currently require restocking.</span>
              ) : (
                <>
                  <p>Hi! We need to order the following pigs today:</p>
                  <br />
                  {alerts.map((item: InventoryAlert) => (
                    <p key={item.itemCategoryId}>
                      - {item.minimumSafetyStock - item.currentStock}x {item.categoryName || `Category #${item.itemCategoryId}`}
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
