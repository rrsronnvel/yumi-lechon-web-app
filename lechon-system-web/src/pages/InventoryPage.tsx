import React, { useState } from "react";
import {
  useInventoryAlerts,
  useGeneratePOs,
  useAdjustStock,
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

interface InventoryAlert {
  itemCategoryId: number;
  categoryName: string;
  currentStock: number;
  minimumSafetyStock: number;
}

export default function InventoryPage() {
  // 1. Fetching Hooks
  const { data: alerts, isLoading, isError } = useInventoryAlerts();
  const generatePOsMutation = useGeneratePOs();
  const adjustStockMutation = useAdjustStock();

  // 2. Local State for our Manual Adjustment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transactionType, setTransactionType] = useState("StockIn"); // Default to StockIn

  // 3. Handlers
  const handleGeneratePO = () => {
    generatePOsMutation.mutate();
  };

  const handleManualAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    adjustStockMutation.mutate({
      itemCategoryId: parseInt(categoryId),
      quantity: parseInt(quantity),
      transactionType: transactionType,
      referenceId: "Manual Override",
    });
    setIsModalOpen(false); // Close the modal after submitting
    setCategoryId("");
    setQuantity("");
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adjust Ledger Balance</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={handleManualAdjustment}
                className="space-y-4 pt-4"
              >
                <div>
                  <label className="text-sm font-medium">
                    Category ID (Weight Bracket)
                  </label>
                  <Input
                    type="number"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                  >
                    <option value="StockIn">Stock In (+)</option>
                    <option value="StockOut">Stock Out (-)</option>
                    <option value="Adjustment">Shrinkage/Adjustment (-)</option>
                  </select>
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
            {/* If our array is empty, show a friendly message */}
            {!alerts || alerts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground h-24"
                >
                  All stock levels are optimal. No alerts.
                </TableCell>
              </TableRow>
            ) : (
              // Map through the data if it exists
              alerts.map((item: InventoryAlert) => (
                <TableRow key={item.itemCategoryId}>
                  <TableCell className="font-medium">
                    {item.categoryName || `Category #${item.itemCategoryId}`}
                  </TableCell>
                  <TableCell>{item.currentStock}</TableCell>
                  <TableCell>{item.minimumSafetyStock}</TableCell>
                  <TableCell>
                    {item.currentStock <= item.minimumSafetyStock ? (
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
    </div>
  );
}
