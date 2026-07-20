import React from "react";
import {
  usePendingConfirmations,
  useDeliveryVerifications,
  useDefrostRoster,
} from "@/hooks/useDashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios"; // or your apiClient if you use one
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePendingSettlements } from "@/hooks/useManifest"; // Or wherever your settlement hook lives
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import EditOrderForm from "@/components/ui/orders/EditOrderForm"; // Adjust path if needed!
import { useState } from "react";
import { useOrderDetails } from "@/hooks/useOrderDetails"; // Your deep fetch hook!
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLogPayment } from "@/hooks/useLogPayment";

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // The engine that fires our new C# cancellation endpoint
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // Pointing directly to the new OrdersController endpoint we just built
      const response = await axios.patch(
        `http://localhost:5199/api/orders/${orderId}/cancel`,
      );
      return response.data;
    },
    onSuccess: () => {
      // 1. Wipe the old dashboard data so the cancelled order disappears
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "pending-confirmations"],
      });
      // 2. Wipe the inventory cache so the freed-up pig instantly appears available
      queryClient.invalidateQueries({ queryKey: ["inventory", "balances"] });
    },
  });

  // 1. Dispatch our three data messengers simultaneously
  const {
    data: pending,
    isLoading: pendingLoading,
    isError: pendingError,
  } = usePendingConfirmations();
  const {
    data: deliveries,
    isLoading: deliveriesLoading,
    isError: deliveriesError,
  } = useDeliveryVerifications();
  const {
    data: defrost,
    isLoading: defrostLoading,
    isError: defrostError,
  } = useDefrostRoster();

  // 1. Fetch the pending settlements
  const { data: settlements } = usePendingSettlements();

  // 2. Tomorrow's Lechon Count (Sum up the total quantity of pigs defrosting tonight)
  const tomorrowCount =
    defrost?.reduce((total, item) => total + item.quantity, 0) || 0;

  // 3. The Overdue Radar (Check if any unremitted trips are from yesterday or older)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to midnight for a strict date comparison

  const overdueRemittances =
    settlements?.filter((trip) => {
      // Assuming your DTO uses 'dispatchTime' or 'date'. Adjust if needed!
      const tripDate = new Date(trip.dispatchTime);
      return tripDate < today;
    }) || [];

  // 4. Unified Operations Roster (Shift-Aware Math)
  const unifiedRoster =
    defrost?.map((item) => {
      const rushCutoff = new Date(item.tahiStartTime);

      // 🚀 THE NIGHT SHIFT FIX:
      // If the prep time is early tomorrow morning (before noon),
      // the 12 PM warning cutoff needs to happen TODAY (subtract 1 day).
      if (rushCutoff.getHours() < 12) {
        rushCutoff.setDate(rushCutoff.getDate() - 1);
      }

      // Set the cutoff strictly to 12:00 PM Noon
      rushCutoff.setHours(12, 0, 0, 0);

      // Is the exact current time past the Noon cutoff?
      const isRush = new Date() >= rushCutoff;

      return {
        ...item,
        // Ensure we display the address if it exists, otherwise default to "Store Pickup"
        deliveryAddress: item.deliveryAddress
          ? item.deliveryAddress
          : "Store Pickup",
        isRush: isRush,
      };
    }) || [];

  // Helper component to show a pulsing loading state
  const DashboardSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  // --- THE NEW ACTION CENTER STATE ---
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // 🚀 NEW: State for the Log Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");
  const paymentMutation = useLogPayment();

  // Deep Fetch the heavy data only when a row is clicked!
  const { data: orderDetails, isLoading: isDetailsLoading } =
    useOrderDetails(selectedOrderId);

  const handleEditClick = (id: number) => {
    setSelectedOrderId(id);
    setIsSheetOpen(true);
  };
  // -----------------------------------

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Operations</h1>
        <p className="text-muted-foreground mt-2">
          Your zero-inbox command center for today.
        </p>
      </div>

      {/* 🚀 QUICK-GLANCE WIDGETS (Command Center HUD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Widget 1: Tomorrow's Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tomorrow's Lechon Count
            </CardTitle>
            <span className="text-2xl">🥩</span>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{tomorrowCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total pigs locked for tomorrow's production
            </p>
          </CardContent>
        </Card>

        {/* Widget 2: Pending Remittance Tracker */}
        <Card
          className={
            overdueRemittances.length > 0 ? "border-red-500 bg-red-50" : ""
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={`text-sm font-medium ${overdueRemittances.length > 0 ? "text-red-700" : ""}`}
            >
              Overdue Remittances
            </CardTitle>
            <span className="text-2xl">🚨</span>
          </CardHeader>
          <CardContent>
            {overdueRemittances.length === 0 ? (
              <div className="text-2xl font-bold text-green-600">0</div>
            ) : (
              <div className="space-y-2 mt-2">
                {overdueRemittances.map((trip) => (
                  <div
                    key={trip.id}
                    className="flex justify-between items-center bg-white p-2 rounded border border-red-200"
                  >
                    <span className="font-semibold text-red-700">
                      {trip.riderName}
                    </span>
                    <span className="font-bold text-red-700">
                      ₱{(trip.amountToCollect || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Trips from previous days missing GCash/Cash drops
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PRIORITY 1: The Money (Pending Confirmations) */}
      <Card className="border-t-4 border-t-red-500">
        <CardHeader>
          <CardTitle className="text-red-700 flex justify-between items-center">
            Action Required: Pending Downpayments
            {pending && pending.length > 0 && (
              <Badge variant="destructive">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingLoading && <DashboardSkeleton />}
          {pendingError && (
            <p className="text-red-500">
              Failed to load pending confirmations.
            </p>
          )}

          {/* Empty State / Zero-Inbox */}
          {pending?.length === 0 && (
            <div className="text-center py-6 text-green-600 font-medium">
              🎉 All caught up! No pending confirmations.
            </div>
          )}

          {/* Data Table */}
          {pending && pending.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Target Delivery</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((item) => (
                  <TableRow key={item.id}>
                    {/* 2. Change the displayed text */}
                    <TableCell className="font-medium">#{item.id}</TableCell>

                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>
                      {new Date(item.targetDeliveryTime).toLocaleString()}
                    </TableCell>
                    <TableCell>{item.phoneNumber}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      ₱{(item?.totalAmount ?? 0).toLocaleString()}
                    </TableCell>
                    {/* 🚀 CLEANED UP BUTTON GROUP */}
                    <TableCell className="text-right flex justify-end gap-2 items-center">
                      {/* BUTTON 1: Triggers the Deep Fetch & Opens the Sheet */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleEditClick(item.id)}
                      >
                        Log Payment / Edit
                      </Button>

                      {/* BUTTON 2: The Existing Cancel Button */}
                      <AlertDialog>
                        <AlertDialogTrigger className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700">
                          Cancel
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Are you absolutely sure?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently void Order #{item.id} and
                              instantly release their locked lechon back to the
                              available inventory pool.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Order</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() =>
                                cancelOrderMutation.mutate(item.id)
                              }
                            >
                              Yes, cancel this order
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 🚀 UNIFIED OPERATIONS ROSTER */}
      <Card className="border-t-4 border-t-blue-600 shadow-md">
        <CardHeader>
          <CardTitle className="text-blue-800 flex justify-between items-center">
            Operations Roster: Defrost & Dispatch
            {unifiedRoster.length > 0 && (
              <Badge className="bg-blue-600">
                {unifiedRoster.length} Active
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Combined view of tonight's prep requirements and tomorrow's delivery
            targets.
          </p>
        </CardHeader>
        <CardContent>
          {defrostLoading || deliveriesLoading ? (
            <DashboardSkeleton />
          ) : unifiedRoster.length === 0 ? (
            <div className="text-center py-8 text-green-600 font-medium bg-green-50 rounded-md border border-green-100">
              ✅ All clear! No items scheduled for prep or delivery.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-bold">Item #</TableHead>
                  <TableHead className="font-bold">
                    Customer & Routing
                  </TableHead>
                  <TableHead className="font-bold">Size / Qty</TableHead>
                  <TableHead className="font-bold">
                    Prep (Tahi) Deadline
                  </TableHead>
                  <TableHead className="font-bold">Target Delivery</TableHead>
                  <TableHead className="text-right font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unifiedRoster.map((item) => (
                  <TableRow
                    key={item.id}
                    className={item.isRush ? "bg-red-50/50" : ""}
                  >
                    <TableCell className="font-medium">#{item.id}</TableCell>

                    <TableCell>
                      <div className="font-semibold flex items-center gap-2">
                        {item.customerName}
                        {/* 👑 THE VIP BADGE */}
                        {item.isTrustedCustomer && (
                          <Badge
                            variant="outline"
                            className="bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-800 border-amber-400 text-[10px] h-5 py-0 px-1.5 shadow-sm"
                          >
                            👑 VIP
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {item.deliveryAddress}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="bg-white">
                        {item.weightCategory}
                      </Badge>
                      <span className="ml-2 text-sm font-medium">
                        x{item.quantity}
                      </span>
                    </TableCell>

                    <TableCell
                      className={`font-semibold ${item.isRush ? "text-red-600" : "text-blue-600"}`}
                    >
                      {new Date(item.tahiStartTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>

                    {/* THE REAL TARGET DELIVERY TIME FROM C# */}
                    <TableCell className="text-sm font-medium">
                      {new Date(item.targetDeliveryTime).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {item.isRush ? (
                        <Badge variant="destructive" className="animate-pulse">
                          RUSH
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600">
                          ON SCHEDULE
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 🚀 THE MASTER ACTION CENTER SLIDE-OUT */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl bg-slate-50">
          <SheetHeader className="mb-6 border-b pb-4">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-2xl text-slate-800">
                  Action Center: Order #{selectedOrderId}
                </SheetTitle>
                <SheetDescription>
                  Log GCash deposits or update operational details.
                </SheetDescription>
              </div>

              {/* 🚀 THE NEW LOG PAYMENT BUTTON */}
              {selectedOrderId && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  onClick={() => setIsPaymentOpen(true)}
                >
                  💳 Log Payment
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Conditional Rendering: Wait for the deep fetch to finish! */}
          {isDetailsLoading ? (
            <div className="py-16 text-center text-slate-500 animate-pulse">
              Securely fetching financial dossier...
            </div>
          ) : orderDetails ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <EditOrderForm
                order={orderDetails}
                onClose={() => setIsSheetOpen(false)}
              />
            </div>
          ) : (
            <div className="text-center text-red-500 py-10">
              Failed to load order details.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 🚀 THE SECURE PAYMENT MODAL */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Additional Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Amount Received (₱)
              </label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || "")}
                placeholder="e.g., 3000"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 mt-1 rounded-md border border-input bg-white px-3"
              >
                <option value="GCash">GCash</option>
                <option value="Cash">Physical Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2 h-11"
              disabled={paymentMutation.isPending || !paymentAmount}
              onClick={() => {
                if (!selectedOrderId) return;
                
                paymentMutation.mutate(
                  {
                    orderId: selectedOrderId,
                    amount: Number(paymentAmount),
                    paymentProvider: paymentMethod,
                  },
                  {
                    onSuccess: () => {
                      setIsPaymentOpen(false);
                      setPaymentAmount("");
                      // We close the Action Center drawer as well so the user sees the fresh dashboard
                      setIsSheetOpen(false); 
                    },
                  }
                );
              }}
            >
              {paymentMutation.isPending ? "Logging..." : "Confirm Deposit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
