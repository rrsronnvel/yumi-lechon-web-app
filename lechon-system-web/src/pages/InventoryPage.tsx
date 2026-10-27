import { useState } from "react";
import {
  useInventoryAlerts,
  useInventoryLedger,
  useInventoryBalances,
  type InventoryBalance,
  type InventoryAlert,
  type InventoryTransaction,
} from "../hooks/useInventory";
import ReceiveStockModal from "@/components/ui/inventory/ReceiveStockModal";
import AdjustLedgerModal from "@/components/ui/inventory/AdjustLedgerModal";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function InventoryPage() {
  // 1. Fetching Hooks
  const { data: alerts, isLoading: isAlertsLoading, isError: isAlertsError } = useInventoryAlerts();
  const { data: ledgerData, isLoading: isLedgerLoading } = useInventoryLedger();
  const { data: balances, isLoading: isBalancesLoading, isError: isBalancesError } = useInventoryBalances();

  // 2. Local Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  // 3. Handlers
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
      toast.success("Order list copied to clipboard! You can now paste it into Messenger.");
    });
  };

  if (isBalancesLoading && isAlertsLoading) {
    return <div className="p-8 text-stone-500">Checking the freezer scoreboard...</div>;
  }

  if (isBalancesError || isAlertsError) {
    return (
      <div className="p-8 text-rose-600 font-medium">
        Error connecting to the inventory and ledger engine.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Inventory & Procurement
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Dual-stock forecasting: track physical chest freezers vs. 14-day committed reservations.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {/* FREEZER-GATE INTAKE */}
          <Button
            onClick={() => setIsReceiveModalOpen(true)}
            className="h-10 w-full bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700 sm:w-auto"
          >
            + Log Freezer Intake
          </Button>

          {/* THE OVERRIDE SWITCH (MODAL) */}
          <Button
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="h-10 w-full border-stone-300 font-medium text-stone-700 hover:bg-stone-100 sm:w-auto"
          >
            Manual Adjustment
          </Button>

          <AdjustLedgerModal
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
          />

          {/* FREEZER-GATE INTAKE MODAL */}
          <ReceiveStockModal
            open={isReceiveModalOpen}
            onOpenChange={setIsReceiveModalOpen}
          />
        </div>
      </div>

      {/* THE DASHBOARD DISPLAY */}
      <Tabs defaultValue="balances" className="w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          <TabsList className="mb-5 flex h-auto min-w-full w-max gap-1.5 rounded-xl bg-stone-200/60 p-1.5 sm:mb-6">
            <TabsTrigger
              value="balances"
              className="shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium text-stone-600 transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
            >
              Live Balances
            </TabsTrigger>
            <TabsTrigger
              value="ledger"
              className="shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium text-stone-600 transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
            >
              Audit Ledger
            </TabsTrigger>
            <TabsTrigger
              value="procurement"
              className="shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium text-stone-600 transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm"
            >
              Procurement
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Live Balances (6-Column Scoreboard) */}
        <TabsContent value="balances">
          <div className="w-full overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-100/70 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                  <TableHead className="font-semibold text-stone-600">Weight Bracket</TableHead>
                  <TableHead className="text-right font-semibold text-stone-600">
                    Physical (On-Hand)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-stone-600">
                    Locked (14d)
                  </TableHead>
                  <TableHead className="text-right font-semibold text-stone-600">
                    Available
                  </TableHead>
                  <TableHead className="text-right font-semibold text-stone-600">
                    Safety Level
                  </TableHead>
                  <TableHead className="text-center font-semibold text-stone-600">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-stone-200/70">
                {isBalancesLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-stone-500 h-28"
                    >
                      Calculating dual-stock balances...
                    </TableCell>
                  </TableRow>
                ) : !balances || balances.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-stone-500 h-28"
                    >
                      No categories found in the database.
                    </TableCell>
                  </TableRow>
                ) : (
                  balances.map((item: InventoryBalance) => (
                    <TableRow key={item.categoryId} className="hover:bg-stone-50/70 transition-colors">
                      {/* Column 1: Weight Bracket */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-stone-900 font-semibold">
                            {item.categoryName || `Category #${item.categoryId}`}
                          </span>
                          {item.weightRangeDisplay && (
                            <span className="text-xs text-stone-600 font-mono bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                              {item.weightRangeDisplay}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Column 2: Physical (On-Hand) */}
                      <TableCell className="text-right font-mono font-medium text-stone-800">
                        {item.physicalStock}
                      </TableCell>

                      {/* Column 3: Locked (14d) */}
                      <TableCell className="text-right font-mono text-stone-600">
                        {item.lockedStock}
                      </TableCell>

                      {/* Column 4: Available */}
                      <TableCell className="text-right font-mono font-bold">
                        <span
                          className={
                            item.availableStock < 0
                              ? "text-rose-600"
                              : item.availableStock <= item.minimumSafetyStock
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }
                        >
                          {item.availableStock}
                        </span>
                      </TableCell>

                      {/* Column 5: Safety Level */}
                      <TableCell className="text-right font-mono text-stone-500">
                        {item.minimumSafetyStock}
                      </TableCell>

                      {/* Column 6: Status */}
                      <TableCell className="text-center">
                        {item.healthStatus === "Optimal" ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                          >
                            Optimal
                          </Badge>
                        ) : item.healthStatus === "Low Stock" ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 font-semibold"
                          >
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700 border-rose-300 font-semibold"
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
          <div className="w-full overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-100/70 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                  <TableHead className="font-semibold text-stone-600">Date & Time</TableHead>
                  <TableHead className="font-semibold text-stone-600">Type</TableHead>
                  <TableHead className="text-right font-semibold text-stone-600">Quantity</TableHead>
                  <TableHead className="font-semibold text-stone-600">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-stone-200/70">
                {isLedgerLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-28 text-stone-500"
                    >
                      Loading ledger records...
                    </TableCell>
                  </TableRow>
                ) : !ledgerData || ledgerData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-28 text-stone-500"
                    >
                      No transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerData.map((tx: InventoryTransaction) => (
                    <TableRow key={tx.id} className="hover:bg-stone-50/70 transition-colors">
                      <TableCell className="font-medium text-stone-700">
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
                            tx.transactionType === "StockIn"
                              ? "bg-emerald-600 text-white"
                              : tx.transactionType === "Adjustment"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : "bg-rose-600 text-white"
                          }
                        >
                          {tx.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-stone-900">
                        {tx.quantity}
                      </TableCell>
                      <TableCell className="text-stone-600 italic">
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
          <div className="space-y-4 rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Supplier Order Draft
                </h3>
                <p className="text-sm text-stone-500">
                  Review restock deficits calculated against minimum safety levels.
                </p>
              </div>
              <Button
                onClick={handleCopyProcurement}
                disabled={!alerts || alerts.length === 0}
                className="bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors"
              >
                Copy for Messenger
              </Button>
            </div>

            {/* The Text List */}
            <div className="bg-stone-50 p-4 rounded-xl font-mono text-sm whitespace-pre-wrap border border-stone-200 text-stone-800">
              {!alerts || alerts.length === 0 ? (
                <span className="text-stone-500 italic">
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
