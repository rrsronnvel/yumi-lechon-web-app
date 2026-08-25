import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  usePendingConfirmations,
  useDeliveryVerifications,
  useDefrostRoster,
  useRenegotiationTasks,
} from "@/hooks/useDashboard";
import { usePendingSettlements, PendingSettlementDrop } from "@/hooks/useManifest";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useLogPayment } from "@/hooks/useLogPayment";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EditOrderForm from "@/components/ui/orders/EditOrderForm";

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // Mutations
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await axios.patch(
        `http://localhost:5199/api/orders/${orderId}/cancel`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Order Cancelled", {
        description: "The order has been voided and inventory released.",
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "pending-confirmations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "renegotiations"],
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "balances"] });
    },
  });

  const agreeToHikeMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await axios.patch(
        `http://localhost:5199/api/orders/${orderId}/renegotiate/agree`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Price Updated!", {
        description:
          "The customer's order price has been updated to match the current menu.",
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "renegotiations"],
      });
    },
  });

  const waiveHikeMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await axios.patch(
        `http://localhost:5199/api/orders/${orderId}/renegotiate/waive`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Price Waived", {
        description:
          "The old price has been permanently locked for this customer.",
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "renegotiations"],
      });
    },
  });

  // Query Hooks
  const {
    data: pending,
    isLoading: pendingLoading,
    isError: pendingError,
  } = usePendingConfirmations();
  const {
    isLoading: deliveriesLoading,
  } = useDeliveryVerifications();
  const {
    data: defrost,
    isLoading: defrostLoading,
  } = useDefrostRoster();
  const { data: settlements = [] } = usePendingSettlements();
  const { data: renegotiations } = useRenegotiationTasks();

  // 1. Tomorrow's Lechon Count
  const tomorrowCount =
    defrost?.reduce((total, item) => total + item.quantity, 0) || 0;

  // 2. Pending Remittances Math
  const totalPendingRemittance = settlements.reduce(
    (total: number, drop: PendingSettlementDrop) => total + (drop.netRemittance || 0),
    0
  );

  // 3. Unified Operations Roster (Shift-Aware Math)
  const unifiedRoster =
    defrost?.map((item) => {
      const rushCutoff = new Date(item.tahiStartTime);

      if (rushCutoff.getHours() < 12) {
        rushCutoff.setDate(rushCutoff.getDate() - 1);
      }
      rushCutoff.setHours(12, 0, 0, 0);

      const isRush = new Date() >= rushCutoff;

      return {
        ...item,
        deliveryAddress: item.deliveryAddress
          ? item.deliveryAddress
          : "Store Pickup",
        isRush,
      };
    }) || [];

  // Modal & Slide-out State
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");

  const paymentMutation = useLogPayment();
  const { data: orderDetails, isLoading: isDetailsLoading } =
    useOrderDetails(selectedOrderId);

  const handleEditClick = (id: number) => {
    setSelectedOrderId(id);
    setIsSheetOpen(true);
  };

  const DashboardSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

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
        <Card className={settlements.length > 0 ? "border-amber-400 bg-amber-50/40" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={`text-sm font-medium ${
                settlements.length > 0 ? "text-amber-800" : ""
              }`}
            >
              Floating Rider Remittances
            </CardTitle>
            <span className="text-2xl">🛵</span>
          </CardHeader>
          <CardContent>
            {settlements.length === 0 ? (
              <div>
                <div className="text-3xl font-bold text-emerald-600">₱0</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All rider collections are reconciled and accounted for.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-3xl font-bold text-amber-900 font-mono">
                  ₱{totalPendingRemittance.toLocaleString()}
                </div>
                <div className="space-y-1.5 mt-3 max-h-36 overflow-y-auto pr-1">
                  {settlements.map((drop: PendingSettlementDrop) => (
                    <div
                      key={drop.id}
                      className="flex justify-between items-center bg-white p-2 rounded border border-amber-200 text-xs shadow-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">
                          {drop.riderName}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          Order #{drop.orderId} • {drop.customerName}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700">
                        ₱{drop.netRemittance.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {settlements.length} active drop{settlements.length > 1 ? "s" : ""} pending drawer settlement
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Peak Season Renegotiation Alarm */}
      {renegotiations && renegotiations.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-red-500 bg-red-50 p-4 shadow-sm">
          <h2 className="mb-2 text-xl font-bold text-red-700 flex items-center">
            ⚠️ Action Required: Peak Season Price Updates
          </h2>
          <p className="mb-4 text-sm text-red-600">
            The following advance bookings are locked at old menu prices. Please
            contact the customers.
          </p>

          <div className="grid gap-3">
            {renegotiations.map((task) => (
              <div
                key={task.orderId}
                className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    Order #{task.orderId} - {task.customerName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Delivery: {new Date(task.targetDeliveryTime).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                    Gap: ₱{task.priceGap.toLocaleString()}
                  </span>

                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                        disabled={agreeToHikeMutation.isPending}
                      >
                        {agreeToHikeMutation.isPending ? "Updating..." : "Customer Agreed"}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Update Order Price?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will mathematically increase Order #{task.orderId}'s locked
                            price to match the live menu price. The customer's remaining
                            balance will increase by ₱{task.priceGap.toLocaleString()}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => agreeToHikeMutation.mutate(task.orderId)}
                          >
                            Yes, Customer Agreed
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger
                        className="text-xs bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 disabled:opacity-50"
                        disabled={waiveHikeMutation.isPending}
                      >
                        {waiveHikeMutation.isPending ? "Waiving..." : "Waive Hike"}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Waive Price Hike?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently lock in the old, cheaper price for Order
                            #{task.orderId} and dismiss this warning to keep the customer happy.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-gray-600 hover:bg-gray-700"
                            onClick={() => waiveHikeMutation.mutate(task.orderId)}
                          >
                            Yes, Waive Hike
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger
                        className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                        disabled={cancelOrderMutation.isPending}
                      >
                        Cancel
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Order #{task.orderId}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently void the order and instantly release their
                            locked lechon back to the available inventory pool.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Order</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => cancelOrderMutation.mutate(task.orderId)}
                          >
                            Yes, Cancel Order
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRIORITY 1: Pending Confirmations */}
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
            <p className="text-red-500">Failed to load pending confirmations.</p>
          )}

          {pending?.length === 0 && (
            <div className="text-center py-6 text-green-600 font-medium">
              🎉 All caught up! No pending confirmations.
            </div>
          )}

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
                    <TableCell className="font-medium">#{item.id}</TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>
                      {new Date(item.targetDeliveryTime).toLocaleString()}
                    </TableCell>
                    <TableCell>{item.phoneNumber}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      ₱{(item?.totalAmount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleEditClick(item.id)}
                      >
                        Log Payment / Edit
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700">
                          Cancel
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently void Order #{item.id} and instantly release
                              their locked lechon back to the available inventory pool.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Order</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => cancelOrderMutation.mutate(item.id)}
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
              <Badge className="bg-blue-600">{unifiedRoster.length} Active</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Combined view of tonight's prep requirements and tomorrow's delivery targets.
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
                  <TableHead className="font-bold">Customer & Routing</TableHead>
                  <TableHead className="font-bold">Size / Qty</TableHead>
                  <TableHead className="font-bold">Prep (Tahi) Deadline</TableHead>
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
                      <span className="ml-2 text-sm font-medium">x{item.quantity}</span>
                    </TableCell>
                    <TableCell
                      className={`font-semibold ${
                        item.isRush ? "text-red-600" : "text-blue-600"
                      }`}
                    >
                      {new Date(item.tahiStartTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {new Date(item.targetDeliveryTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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

      {/* Master Action Center Slide-Out */}
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

      {/* Payment Modal */}
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
                onChange={(e) =>
                  setPaymentAmount(parseFloat(e.target.value) || "")
                }
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