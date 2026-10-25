import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  usePendingConfirmations,
  useDeliveryVerifications,
  useDefrostRoster,
  useRenegotiationTasks,
  usePendingOwnerConfirmations,
  useConfirmOwnerOrderMutation,
} from "@/hooks/useDashboard";
import { usePendingSettlements, PendingSettlementDrop } from "@/hooks/useManifest";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useLogPayment } from "@/hooks/useLogPayment";
import { useInventoryBalances } from "@/hooks/useInventory";
import { useMenuCategories } from "@/hooks/useCms";

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
import OrderForm from "@/components/ui/orders/OrderForm";
import { Plus, FileText, Copy, Lock } from "lucide-react";
import {
  generateVerificationReminder,
  generateDefrostRosterMessage,
  TemplateOrderData,
} from "@/utils/messengerTemplates";

const NON_CARCASS_ADDON_PATTERN =
  /\b(?:sarsa|sauce|dinuguan|pancit|pansit|palabok|spaghetti|puto|coke)\b/i;

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { isOwner } = useAuth();

  // Dialog State for POS Order Entry
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Mutations
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiClient.patch(`/orders/${orderId}/cancel`);
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
      const response = await apiClient.patch(
        `/orders/${orderId}/renegotiate/agree`
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
      const response = await apiClient.patch(
        `/orders/${orderId}/renegotiate/waive`
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
  const { isLoading: deliveriesLoading } = useDeliveryVerifications();
  const { data: defrost, isLoading: defrostLoading } = useDefrostRoster();
  const carcassOnlyDefrost = useMemo(
    () =>
      (defrost || []).filter((item) => {
        if (
          item.minimumWeightKg !== undefined &&
          item.minimumWeightKg <= 0
        ) {
          return false;
        }
        return !NON_CARCASS_ADDON_PATTERN.test(
          [item.categoryName, item.weightCategory, item.weightRange]
            .filter(Boolean)
            .join(" "),
        );
      }),
    [defrost],
  );
  const { data: settlements = [] } = usePendingSettlements();
  const { data: renegotiations } = useRenegotiationTasks();
  const { data: pendingOwnerConfirmations = [] } =
    usePendingOwnerConfirmations();
  const confirmOwnerMutation = useConfirmOwnerOrderMutation();
  const { data: inventoryBalances = [] } = useInventoryBalances();
  const { data: menuCategories = [] } = useMenuCategories();

  // 1. Tomorrow's Roasting Demand Math & Breakdown
  const tomorrowCount =
    carcassOnlyDefrost.reduce((total, item) => total + item.quantity, 0);

  const carcassBreakdown = useMemo(() => {
    if (carcassOnlyDefrost.length === 0) return "No roasting scheduled for tomorrow";
    const map = new Map<string, number>();
    for (const d of carcassOnlyDefrost) {
      const key = d.weightCategory || "Lechon";
      map.set(key, (map.get(key) || 0) + d.quantity);
    }
    const parts: string[] = [];
    map.forEach((qty, name) => {
      parts.push(`${qty} ${name}`);
    });
    return parts.join(" • ");
  }, [carcassOnlyDefrost]);

  // 2. Pending Remittances Math & Overdue Detector (> 24 hours)
  const totalPendingRemittance = settlements.reduce(
    (total: number, drop: PendingSettlementDrop) => total + (drop.netRemittance || 0),
    0
  );

  const hasOverdueRemittance = useMemo(() => {
    if (!settlements || settlements.length === 0) return false;
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    return settlements.some((drop: PendingSettlementDrop) => {
      const timestamp = drop.targetDeliveryTime || drop.dispatchTime || drop.createdAt;
      if (!timestamp) return false;
      const diff = now - new Date(timestamp).getTime();
      return diff > ONE_DAY_MS;
    });
  }, [settlements]);

  // 3. Freezer Safety Stock Health Math
  const safetyStockHealth = useMemo(() => {
    const carcassCategories = menuCategories.filter(
      (c) => c.minimumWeightKg > 0 && (c.minimumSafetyStock ?? 0) > 0
    );

    let lowCount = 0;

    if (carcassCategories.length > 0) {
      for (const cat of carcassCategories) {
        const bal = inventoryBalances.find((b) => b.categoryId === cat.id);
        const available = bal ? bal.availableStock : 0;
        const minStock = cat.minimumSafetyStock ?? 0;
        if (available <= minStock) {
          lowCount++;
        }
      }
    } else if (inventoryBalances.length > 0) {
      for (const b of inventoryBalances) {
        if (b.minimumSafetyStock > 0 && b.availableStock <= b.minimumSafetyStock) {
          lowCount++;
        }
      }
    }

    return {
      isLow: lowCount > 0,
      count: lowCount,
    };
  }, [inventoryBalances, menuCategories]);

  // 4. Unified Operations Roster (Shift-Aware Math)
  const unifiedRoster = useMemo(() => {
    return (
      carcassOnlyDefrost.map((item) => {
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
      })
    );
  }, [carcassOnlyDefrost]);

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
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        {/* Operational Header HUD */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/90 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              Daily Operations
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date())} — Store Operations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => window.open("/daily-sheets", "_blank")}
              className="border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs sm:text-sm h-10 px-4 shadow-2xs"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Daily Sheets
            </Button>

            <Button
              onClick={() => setIsOrderModalOpen(true)}
              className="bg-[#C81E1E] hover:bg-[#A81818] text-white font-medium shadow-sm transition-colors text-xs sm:text-sm h-10 px-4"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Order
            </Button>
          </div>
        </div>

        {/* 🚀 Symmetrical 3-Card KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Tomorrow's Roasting Demand */}
          <Card className="min-h-[140px] flex flex-col justify-between bg-white border-stone-200/90 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-5">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Tomorrow&apos;s Roasting Demand
              </CardTitle>
              <span className="text-lg">🍖</span>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-1">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
                {tomorrowCount} {tomorrowCount === 1 ? "Head" : "Heads"} Locked
              </div>
              <p
                className="text-xs text-stone-500 mt-1 truncate"
                title={carcassBreakdown}
              >
                {carcassBreakdown}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Floating Rider Remittances */}
          <Card
            className={`min-h-[140px] flex flex-col justify-between bg-white border-stone-200/90 shadow-sm rounded-xl ${
              hasOverdueRemittance ? "border-rose-300 bg-rose-50/40" : ""
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Unremitted Cash Radar
                </CardTitle>
                {hasOverdueRemittance && (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5 bg-rose-600 text-white">
                    Overdue Remittance
                  </Badge>
                )}
              </div>
              <span className="text-lg">🛵</span>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-1">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 font-mono">
                ₱{totalPendingRemittance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-stone-500">
                  {settlements.length} active drop{settlements.length === 1 ? "" : "s"} pending
                </span>
                <Link
                  to="/manifest"
                  className="text-xs text-[#C81E1E] hover:underline font-semibold inline-flex items-center"
                >
                  Settle in Manifest &rarr;
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Freezer Safety Stock Health */}
          <Card className="min-h-[140px] flex flex-col justify-between bg-white border-stone-200/90 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-5">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Freezer Safety Stock
              </CardTitle>
              {safetyStockHealth.isLow ? (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 bg-amber-50 text-amber-800 border-amber-300 font-medium"
                >
                  Warning
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 bg-emerald-50 text-emerald-800 border-emerald-300 font-medium"
                >
                  Optimal
                </Badge>
              )}
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-1">
              {safetyStockHealth.isLow ? (
                <div>
                  <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-900">
                    ⚠️ {safetyStockHealth.count} {safetyStockHealth.count === 1 ? "Category" : "Categories"} Low
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-stone-500">
                      Stock below safety threshold
                    </span>
                    <Link
                      to="/inventory"
                      className="text-xs text-[#C81E1E] hover:underline font-semibold inline-flex items-center"
                    >
                      Manage Stock &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-800">
                    🟢 All Categories Stocked
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-stone-500">
                      Carcass buffers above thresholds
                    </span>
                    <Link
                      to="/inventory"
                      className="text-xs text-[#C81E1E] hover:underline font-semibold inline-flex items-center"
                    >
                      View Balances &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ⚠️ Peak Season Renegotiation Alarm (Collapses completely to null when 0) */}
        {renegotiations && renegotiations.length > 0 && (
          <div className="rounded-xl border-2 border-rose-500 bg-rose-50 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
              <h2 className="text-xl font-bold text-rose-800 flex items-center gap-2">
                <span>⚠️ Action Required: Peak Season Price Updates</span>
              </h2>
              {!isOwner && (
                <span
                  className="text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md flex items-center gap-1.5 self-start sm:self-auto"
                  title="Owner authorization required to adjust peak season rates."
                >
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  Owner authorization required to adjust peak season rates.
                </span>
              )}
            </div>
            <p className="mb-4 text-sm text-rose-700">
              The following advance bookings are locked at old menu prices. Please contact the
              customers.
            </p>

            <div className="grid gap-3">
              {renegotiations.map((task) => (
                <div
                  key={task.orderId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3.5 shadow-sm border border-rose-200"
                >
                  <div>
                    <p className="font-semibold text-stone-900">
                      Order #{task.orderReference || task.orderId} - {task.customerName}
                    </p>
                    <p className="text-xs text-stone-500">
                      Delivery: {new Date(task.targetDeliveryTime).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded text-xs font-mono">
                      Gap: ₱{task.priceGap.toLocaleString()}
                    </span>

                    <div className="flex gap-2">
                      {!isOwner ? (
                        <button
                          type="button"
                          disabled
                          title="Owner authorization required to adjust peak season rates."
                          className="text-xs bg-stone-100 text-stone-400 border border-stone-300 px-3 py-1.5 rounded cursor-not-allowed opacity-60 flex items-center gap-1 font-medium select-none"
                        >
                          <Lock className="w-3 h-3 text-stone-400" />
                          <span>Customer Agreed</span>
                        </button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger
                            className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                            disabled={agreeToHikeMutation.isPending}
                          >
                            {agreeToHikeMutation.isPending ? "Updating..." : "Customer Agreed"}
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Update Order Price?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will mathematically increase Order #{task.orderReference || task.orderId}&apos;s locked
                                price to match the live menu price. The customer&apos;s remaining
                                balance will increase by ₱{task.priceGap.toLocaleString()}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => agreeToHikeMutation.mutate(task.orderId)}
                              >
                                Yes, Customer Agreed
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {!isOwner ? (
                        <button
                          type="button"
                          disabled
                          title="Owner authorization required to adjust peak season rates."
                          className="text-xs bg-stone-100 text-stone-400 border border-stone-300 px-3 py-1.5 rounded cursor-not-allowed opacity-60 flex items-center gap-1 font-medium select-none"
                        >
                          <Lock className="w-3 h-3 text-stone-400" />
                          <span>Waive Hike</span>
                        </button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger
                            className="text-xs bg-stone-600 text-white px-3 py-1.5 rounded font-semibold hover:bg-stone-700 disabled:opacity-50 cursor-pointer"
                            disabled={waiveHikeMutation.isPending}
                          >
                            {waiveHikeMutation.isPending ? "Waiving..." : "Waive Hike"}
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Waive Price Hike?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently lock in the old, cheaper price for Order
                                #{task.orderReference || task.orderId} and dismiss this warning to keep the customer happy.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-stone-700 hover:bg-stone-800"
                                onClick={() => waiveHikeMutation.mutate(task.orderId)}
                              >
                                Yes, Waive Hike
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger
                          className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded font-semibold hover:bg-rose-700 disabled:opacity-50"
                          disabled={cancelOrderMutation.isPending}
                        >
                          Cancel
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Order #{task.orderReference || task.orderId}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently void the order and instantly release their
                              locked lechon back to the available inventory pool.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Order</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rose-600 hover:bg-rose-700"
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

        {/* 🚨 PRIORITY 1: Pending Confirmations (Collapses completely to null when 0) */}
        {pendingOwnerConfirmations.length > 0 && (
          <Card className="bg-amber-50/60 border-t-4 border-t-amber-500 border-amber-200 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-950 flex flex-wrap justify-between items-center gap-2 text-lg">
                <span>
                  👑 Awaiting Owner Confirmation ({pendingOwnerConfirmations.length}{" "}
                  {pendingOwnerConfirmations.length === 1 ? "Order" : "Orders"})
                </span>
                {!isOwner && (
                  <Badge variant="outline" className="border-amber-400 text-amber-900">
                    Owner action required
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {pendingOwnerConfirmations.map((item) => (
                <div
                  key={item.orderId}
                  className="rounded-xl border border-amber-300 bg-white p-4 space-y-2"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-bold text-stone-900">
                        #{item.orderReference} • {item.customerName}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Encoded by {item.createdBy}
                        {item.targetDeliveryTime
                          ? ` • ${new Date(item.targetDeliveryTime).toLocaleString()}`
                          : " • Date pending"}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">
                      ₱{item.grandTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-stone-700">{item.itemsSummary}</div>
                  {item.freebiesSummary && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${
                        item.freebiesSummary === "🚫 No Freebies"
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : item.freebiesSummary.includes("Raw Innards") ||
                              item.freebiesSummary.includes(":")
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {item.freebiesSummary}
                    </Badge>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-stone-50 p-2">
                      Delivery Fee: ₱{item.deliveryFee.toLocaleString()}
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2 text-emerald-900">
                      DP: ₱{item.downpayment.toLocaleString()} •{" "}
                      {item.downpaymentMethod === "Cash"
                        ? "💵"
                        : item.downpaymentMethod === "GCash"
                          ? "📱"
                          : item.downpaymentMethod === "Maya"
                            ? "💚"
                            : item.downpaymentMethod === "Bank Transfer"
                              ? "🏦"
                              : "—"}{" "}
                      {item.downpaymentMethod}
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={!isOwner || confirmOwnerMutation.isPending}
                    onClick={() =>
                      confirmOwnerMutation.mutate(item.orderId, {
                        onSuccess: () => toast.success("Order confirmed by Owner."),
                        onError: () => toast.error("Could not confirm this order."),
                      })
                    }
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    ✅ Confirm Order
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {pending && pending.length > 0 && (
          <Card className="bg-white border-t-4 border-t-rose-600 border-stone-200/90 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-rose-700 flex justify-between items-center text-lg">
                <span>Action Required: Pending Downpayments</span>
                <Badge variant="destructive" className="bg-rose-600 text-white">{pending.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLoading && <DashboardSkeleton />}
              {pendingError && (
                <p className="text-rose-600">Failed to load pending confirmations.</p>
              )}

              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-100/70 border-b border-stone-200">
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Order #</TableHead>
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Customer</TableHead>
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Target Delivery</TableHead>
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Phone</TableHead>
                      <TableHead className="text-right text-stone-600 font-semibold uppercase tracking-wider text-xs">Total Amount</TableHead>
                      <TableHead className="w-[180px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((item, index) => {
                      const isEven = index % 2 === 0;
                      return (
                        <TableRow
                          key={item.id}
                          className={`border-b border-stone-200 ${
                            isEven ? "bg-white hover:bg-stone-50" : "bg-stone-50/40 hover:bg-stone-100/60"
                          }`}
                        >
                          <TableCell className="font-medium font-mono text-stone-800">
                            #{item.orderReference || item.id}
                          </TableCell>
                          <TableCell className="font-semibold text-stone-900">
                            {item.customerName}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-stone-700">
                            {new Date(item.targetDeliveryTime).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-stone-600">{item.phoneNumber}</TableCell>
                          <TableCell className="text-right font-bold text-rose-600 font-mono">
                            ₱{(item?.totalAmount ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right flex justify-end gap-2 items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs font-medium"
                              onClick={() => handleEditClick(item.id)}
                            >
                              Log Payment / Edit
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700">
                                Cancel
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently void Order #{item.orderReference || item.id} and instantly release
                                    their locked lechon back to the available inventory pool.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 hover:bg-rose-700"
                                    onClick={() => cancelOrderMutation.mutate(item.id)}
                                  >
                                    Yes, cancel this order
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 🚀 UNIFIED OPERATIONS ROSTER */}
        <Card className="bg-white border-t-4 border-t-[#C81E1E] border-stone-200/90 shadow-sm rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-stone-900 flex flex-wrap justify-between items-center gap-2 text-lg">
              <span>Operations Roster: Defrost & Dispatch</span>
              <div className="flex items-center gap-2">
                {unifiedRoster.length > 0 && (
                  <Badge className="bg-[#C81E1E] text-white">{unifiedRoster.length} Active</Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!unifiedRoster || unifiedRoster.length === 0}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      generateDefrostRosterMessage(unifiedRoster)
                    );
                    toast.success("Defrost list copied for Messenger!");
                  }}
                  className="h-8 text-xs font-semibold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 shadow-2xs cursor-pointer"
                >
                  📋 Copy Defrost List
                </Button>
              </div>
            </CardTitle>
            <p className="text-xs sm:text-sm text-stone-500">
              Combined view of tonight&apos;s prep requirements and tomorrow&apos;s delivery targets. Click any row to inspect customer dossier.
            </p>
          </CardHeader>
          <CardContent>
            {defrostLoading || deliveriesLoading ? (
              <DashboardSkeleton />
            ) : unifiedRoster.length === 0 ? (
              <div className="text-center py-8 text-emerald-700 font-medium bg-emerald-50 rounded-xl border border-emerald-200">
                ✅ All clear! No items scheduled for prep or delivery.
              </div>
            ) : (
              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-100/70 border-b border-stone-200">
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Order #</TableHead>
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Customer & Routing</TableHead>
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Size / Qty</TableHead>
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Prep (Tahi) Deadline</TableHead>
                      <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Target Delivery</TableHead>
                      <TableHead className="text-right text-stone-600 font-semibold uppercase tracking-wider text-xs">Status</TableHead>
                      <TableHead className="w-[50px] text-center text-stone-600 font-semibold uppercase tracking-wider text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unifiedRoster.map((item, index) => {
                      const isEven = index % 2 === 0;
                      return (
                        <TableRow
                          key={item.id}
                          onClick={() => handleEditClick(item.orderId || item.id)}
                          className={`cursor-pointer transition-colors border-b border-stone-200 ${
                            item.isRush
                              ? "bg-rose-50/60 hover:bg-rose-100/70"
                              : isEven
                                ? "bg-white hover:bg-stone-50"
                                : "bg-stone-50/40 hover:bg-stone-100/60"
                          }`}
                        >
                          <TableCell className="font-mono font-medium text-stone-700">
                            #{item.orderReference || item.orderId || item.id}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-stone-900 flex items-center gap-2">
                              {item.customerName}
                              {item.isTrustedCustomer && (
                                <Badge
                                  variant="outline"
                                  className="bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 border-amber-400 text-[10px] h-5 py-0 px-1.5 shadow-2xs font-semibold"
                                >
                                  👑 VIP
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-stone-500 truncate max-w-[220px]">
                              {item.deliveryAddress}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-white border-stone-200 text-stone-800">
                              {item.weightCategory}
                            </Badge>
                            <span className="ml-2 text-sm font-semibold text-stone-700">
                              x{item.quantity}
                            </span>
                          </TableCell>
                          <TableCell
                            className={`font-mono text-xs sm:text-sm font-semibold ${
                              item.isRush ? "text-rose-600" : "text-amber-800"
                            }`}
                          >
                            {new Date(item.tahiStartTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-xs sm:text-sm font-medium text-stone-700">
                            {new Date(item.targetDeliveryTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.isRush ? (
                              <Badge
                                variant="destructive"
                                className="bg-rose-600 hover:bg-rose-700 text-[10px] font-bold tracking-wide uppercase shadow-2xs animate-pulse"
                              >
                                RUSH / LATE DEFROST
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-semibold tracking-wide uppercase shadow-2xs"
                              >
                                NORMAL
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell
                            className="text-center p-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-stone-500 hover:text-[#C81E1E] hover:bg-stone-100"
                              title="Copy 1-Day Verification for Messenger"
                              onClick={(e) => {
                                e.stopPropagation();
                                const orderData: TemplateOrderData = {
                                  orderNumber: item.orderId || item.id,
                                  customerName: item.customerName,
                                  targetDeliveryTime: item.targetDeliveryTime,
                                  fulfillment: item.fulfillment ?? 1,
                                  deliveryAddress: item.deliveryAddress,
                                  landmark: item.landmark || undefined,
                                  items: [
                                    {
                                      categoryName: item.weightCategory,
                                      quantity: item.quantity,
                                    },
                                  ],
                                  subtotal: item.grandTotal ?? 0,
                                  deliveryFee: 0,
                                  grandTotal: item.grandTotal ?? 0,
                                  downpayment: item.downpayment ?? 0,
                                  balanceDue: item.balanceDue ?? 0,
                                };
                                navigator.clipboard.writeText(
                                  generateVerificationReminder(orderData)
                                );
                                toast.success(
                                  "Verification reminder copied for Messenger!"
                                );
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      {/* 🚀 New Order POS Terminal Dialog Modal */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="max-w-5xl xl:max-w-6xl w-full max-h-[92vh] p-0 overflow-hidden gap-0 rounded-xl border-stone-200">
          <DialogHeader className="sr-only">
            <DialogTitle>New POS Order Entry</DialogTitle>
          </DialogHeader>

          <OrderForm
            open={isOrderModalOpen}
            onOpenChange={setIsOrderModalOpen}
            onClose={() => setIsOrderModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Master Action Center Slide-Out */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl bg-[#FAF6F4] p-6">
          <SheetHeader className="mb-6 border-b border-stone-200 pb-4 p-0">
            <div className="flex justify-between items-start gap-2">
              <div>
                <SheetTitle className="text-2xl font-bold text-stone-900">
                  Action Center: Order #{orderDetails?.orderReference || selectedOrderId}
                </SheetTitle>
                <SheetDescription className="text-stone-500">
                  Log GCash deposits or update operational details.
                </SheetDescription>
              </div>

              {selectedOrderId && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-10"
                  onClick={() => setIsPaymentOpen(true)}
                >
                  💳 Log Payment
                </Button>
              )}
            </div>
          </SheetHeader>

          {isDetailsLoading ? (
            <div className="py-16 text-center text-stone-500 animate-pulse">
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
            <div className="text-center text-rose-600 py-10">
              Failed to load order details.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Modal */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="overflow-x-hidden max-w-md w-full p-6 rounded-xl border-stone-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900">Log Additional Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700 block">
                Amount Received (₱)
              </label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) =>
                  setPaymentAmount(parseFloat(e.target.value) || "")
                }
                placeholder="e.g., 3000"
                className="h-10 border-stone-300"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700 block">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 rounded-md border border-stone-300 bg-white px-3 text-sm"
              >
                <option value="GCash">GCash</option>
                <option value="Cash">Physical Cash</option>
                <option value="Maya">Maya</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2 h-11 font-semibold"
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
