import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useOrdersDirectory,
  OrderDirectoryDto,
} from "@/hooks/useOrdersDirectory";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import EditOrderForm from "@/components/ui/orders/EditOrderForm";
import { Button } from "@/components/ui/button";
import OrderForm from "@/components/ui/orders/OrderForm";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useLogPayment } from "@/hooks/useLogPayment";
import { useOrderAuditLogs } from "@/hooks/useOrderAuditLogs";
import { useUpdateCustomerNotesMutation } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useConfirmOwnerOrderMutation } from "@/hooks/useDashboard";
import {
  generateBookingConfirmation,
  TemplateOrderData,
} from "@/utils/messengerTemplates";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDeliveryPricing } from "@/hooks/useCms";
import {
  formatFreebiesSummary,
  parseFreebiesConfig,
} from "@/utils/freebiesHelper";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRESET_CANCEL_REASONS = [
  "Customer Change of Mind",
  "Event Postponed",
  "Weather / Flooded Access",
  "Duplicate Entry",
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOwner } = useAuth();
  const confirmOwnerMutation = useConfirmOwnerOrderMutation();
  const { data: deliveryPricing } = useDeliveryPricing();
  const [filterTab, setFilterTab] = useState("upcoming");
  const [balanceSubFilter, setBalanceSubFilter] = useState<'all' | 'rider' | 'drawer' | 'future'>('all');
  const [rawSearch, setRawSearch] = useState("");
  const debouncedSearch = useDebounce(rawSearch, 300);

  const { data: orders, isLoading } = useOrdersDirectory(
    debouncedSearch,
    filterTab
  );

  const { data: draftOrders } = useOrdersDirectory("", "drafts");
  const draftsCount = draftOrders?.length ?? 0;

  // Reset sub-filter when leaving balance-due tab
  useEffect(() => {
    if (filterTab !== "balance-due") {
      setBalanceSubFilter("all");
    }
  }, [filterTab]);

  // Dynamic calculation for Balance Due custody counts
  const unpaidOrders = useMemo(() => {
    return (orders || []).filter(
      (o) => Number(o.balanceDue || 0) > 0 && !o.isCancelled
    );
  }, [orders]);

  const custodyCounts = useMemo(() => {
    const todayMidnight = new Date().setHours(0, 0, 0, 0);

    let rider = 0;
    let drawer = 0;
    let future = 0;

    unpaidOrders.forEach((o) => {
      const isDrawer =
        o.settlementCustodyStatus === "InStaffDrawer" && !o.isRemittedToOwner;
      const isRider =
        Number(o.fulfillment) === 1 &&
        (o.routingStatus === "Assigned" || o.routingStatus === "OutForDelivery") &&
        o.settlementCustodyStatus !== "InStaffDrawer" &&
        !o.isRemittedToOwner;
      const targetMidnight = o.targetDeliveryTime
        ? new Date(o.targetDeliveryTime).setHours(0, 0, 0, 0)
        : 0;
      const isFuture =
        targetMidnight > todayMidnight &&
        (o.settlementCustodyStatus === "Uncollected" || !o.settlementCustodyStatus);

      if (isDrawer) drawer++;
      if (isRider) rider++;
      if (isFuture) future++;
    });

    return {
      all: unpaidOrders.length,
      rider,
      drawer,
      future,
    };
  }, [unpaidOrders]);

  const displayedOrders = useMemo(() => {
    if (!orders) return [];
    if (filterTab !== "balance-due") return orders;

    if (balanceSubFilter === "all") return unpaidOrders;

    const todayMidnight = new Date().setHours(0, 0, 0, 0);

    return unpaidOrders.filter((o) => {
      if (balanceSubFilter === "rider") {
        return (
          Number(o.fulfillment) === 1 &&
          (o.routingStatus === "Assigned" || o.routingStatus === "OutForDelivery") &&
          o.settlementCustodyStatus !== "InStaffDrawer" &&
          !o.isRemittedToOwner
        );
      }
      if (balanceSubFilter === "drawer") {
        return (
          o.settlementCustodyStatus === "InStaffDrawer" && !o.isRemittedToOwner
        );
      }
      if (balanceSubFilter === "future") {
        const targetMidnight = o.targetDeliveryTime
          ? new Date(o.targetDeliveryTime).setHours(0, 0, 0, 0)
          : 0;
        return (
          targetMidnight > todayMidnight &&
          (o.settlementCustodyStatus === "Uncollected" ||
            !o.settlementCustodyStatus)
        );
      }
      return true;
    });
  }, [orders, filterTab, balanceSubFilter, unpaidOrders]);

  const paymentChannelTotals = useMemo(() => {
    const totals: Record<string, number> = {
      Cash: 0,
      GCash: 0,
      Maya: 0,
      "Bank Transfer": 0,
    };
    displayedOrders.forEach((order) => {
      (order.paymentChannelsSummary || []).forEach((channel) => {
        if (channel.paymentMethod in totals) {
          totals[channel.paymentMethod] += Number(channel.amount) || 0;
        }
      });
    });
    return totals;
  }, [displayedOrders]);

  const [selectedOrder, setSelectedOrder] = useState<OrderDirectoryDto | null>(
    null
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isNotesEditorOpen, setIsNotesEditorOpen] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState("");
  const [draftComplaints, setDraftComplaints] = useState("");
  const paymentMutation = useLogPayment();
  const updateCustomerNotesMutation = useUpdateCustomerNotesMutation();

  const { data, isLoading: isDetailsLoading } = useOrderDetails(
    selectedOrder?.id || null
  );

  const { data: auditLogs, isLoading: isAuditLoading } = useOrderAuditLogs(
    selectedOrder?.id || null
  );
  const orderDetails = data as any;
  const displayedFreebiesSummary = useMemo(() => {
    if (!orderDetails?.freebiesConfigJson) {
      return orderDetails?.freebiesSummary || null;
    }

    const wholePigCount = (orderDetails.orderItems || []).reduce(
      (total: number, item: any) =>
        Number(item.itemCategory?.minimumWeightKg) >= 13
          ? total + (Number(item.quantity) || 0)
          : total,
      0,
    );
    if (wholePigCount <= 0) return orderDetails.freebiesSummary || null;

    return (
      formatFreebiesSummary(
        parseFreebiesConfig(orderDetails.freebiesConfigJson, wholePigCount),
        wholePigCount,
        deliveryPricing?.noFreebiesDiscountPerPig ?? 2000,
      ) || orderDetails.freebiesSummary || null
    );
  }, [orderDetails, deliveryPricing?.noFreebiesDiscountPerPig]);

  const cancelOrderMutation = useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: number;
      reason: string;
    }) => {
      const response = await apiClient.patch(`/orders/${orderId}/cancel`, {
        reason,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      setIsCancelDialogOpen(false);
      setCancellationReason("");
      toast.success(`Order #${variables.orderId} has been cancelled.`);
      queryClient.invalidateQueries({ queryKey: ["orders", "directory"] });
      queryClient.invalidateQueries({
        queryKey: ["orders", variables.orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["order", variables.orderId],
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "balances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || "Failed to cancel order."
      );
    },
  });

  const handleShareDetails = () => {
    if (!orderDetails) return;
    const bookingData: TemplateOrderData = {
      orderNumber: orderDetails.id,
      customerName: orderDetails.customerName || "Customer",
      targetDeliveryTime: orderDetails.targetDeliveryTime,
      fulfillment: Number(orderDetails.fulfillment ?? 1),
      deliveryAddress: orderDetails.deliveryAddress || "",
      landmark: orderDetails.landmark || undefined,
      items: (orderDetails.orderItems || []).map((item: any) => ({
        categoryName: item.itemCategory?.name || "Lechon Size",
        quantity: item.quantity || 1,
      })),
      subtotal: Number(orderDetails.price || 0),
      deliveryFee: Number(orderDetails.deliveryFee || 0),
      grandTotal: Number(orderDetails.grandTotal || 0),
      downpayment: Number(orderDetails.downpayment || 0),
      balanceDue: Number(
        orderDetails.balanceDue ??
          (Number(orderDetails.grandTotal || 0) -
            Number(orderDetails.downpayment || 0))
      ),
      remarks: orderDetails.remarks || "",
    };

    const text = generateBookingConfirmation(bookingData);
    navigator.clipboard.writeText(text);
    toast.success("Booking receipt copied for Messenger!");
  };

  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");

  const handleRowClick = (order: OrderDirectoryDto) => {
    setSelectedOrder(order);
    setIsEditing(false);
    setIsNotesEditorOpen(false);
    setIsSheetOpen(true);
  };

  const renderLocation = (order: OrderDirectoryDto) => {
    const fulfillment = Number(order.fulfillment);
    const address = (order.deliveryAddress || "").trim();

    if (fulfillment === 0) {
      return (
        <Badge
          variant="outline"
          className="bg-slate-50 text-slate-600 border-slate-200 shadow-xs font-normal"
        >
          🏪 Store Pickup
        </Badge>
      );
    }

    if (!address) {
      return (
        <span className="text-xs text-purple-700 font-medium italic flex items-center gap-1">
          📍 Venue TBD / Unset
        </span>
      );
    }

    const truncated =
      address.length > 32 ? `${address.substring(0, 32)}...` : address;

    if (fulfillment === 2) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200 text-xs font-medium"
          >
            📦 Lalamove
          </Badge>
          <span
            className="text-sm text-slate-600 truncate max-w-[200px]"
            title={address}
          >
            {truncated || (
              <span className="italic text-slate-400">No Address</span>
            )}
          </span>
        </div>
      );
    }

    // fulfillment === 1 (Delivery) or default
    return (
      <div className="space-y-0.5">
        <span className="text-sm text-slate-700 block" title={address}>
          {truncated || (
            <span className="italic text-slate-400">No Address Provided</span>
          )}
        </span>
        {order.landmark && (
          <span className="text-[11px] text-amber-800 block truncate max-w-[200px]">
            🧭 {order.landmark}
          </span>
        )}
      </div>
    );
  };

  const renderTargetSchedule = (order: OrderDirectoryDto) => {
    if (!order.targetDeliveryTime) {
      return (
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
            📅 Date Pending
          </span>
          {order.remarks && (
            <span
              className="font-mono text-[10px] text-stone-500 block truncate max-w-[160px]"
              title={order.remarks}
            >
              {order.remarks}
            </span>
          )}
        </div>
      );
    }

    const targetDate = new Date(order.targetDeliveryTime);
    if (isNaN(targetDate.getTime())) {
      return <span className="text-sm text-purple-700 font-semibold">📅 Date Pending</span>;
    }

    const now = new Date();
    const isToday =
      targetDate.getFullYear() === now.getFullYear() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() === now.getDate();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      targetDate.getFullYear() === tomorrow.getFullYear() &&
      targetDate.getMonth() === tomorrow.getMonth() &&
      targetDate.getDate() === tomorrow.getDate();

    const formattedDate = targetDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const formattedTime = targetDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
          <span>{formattedDate}</span>
          {isToday && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Today
            </span>
          )}
          {isTomorrow && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Tomorrow
            </span>
          )}
        </div>
        <div className="text-xs font-medium text-slate-700">
          {formattedTime}
        </div>
      </div>
    );
  };

  const renderCustodyBadge = (order: OrderDirectoryDto) => {
    if (order.settlementCustodyStatus === "InStaffDrawer") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-sans">
          🟡 In Drawer
        </span>
      );
    }
    if (
      Number(order.fulfillment) === 1 &&
      (order.routingStatus === "Assigned" || order.routingStatus === "OutForDelivery")
    ) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-sans">
          🛵 Road Cash
        </span>
      );
    }
    const targetMidnight = order.targetDeliveryTime
      ? new Date(order.targetDeliveryTime).setHours(0, 0, 0, 0)
      : 0;
    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    if (targetMidnight > todayMidnight) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-sans">
          📅 Advance
        </span>
      );
    }
    if (Number(order.fulfillment) === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-sans">
          🏪 Store Pickup
        </span>
      );
    }
    return null;
  };

  const renderFinancialGrid = (order: OrderDirectoryDto) => {
    if (order.isDraft) {
      return (
        <div className="tabular-nums font-mono text-right space-y-0.5">
          <div className="font-bold text-purple-900 text-sm">
            Est. ₱{Number(order.grandTotal || 0).toLocaleString()}
          </div>
          <div>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
              ₱{Number(order.downpayment || 0).toLocaleString()} DP
            </span>
          </div>
        </div>
      );
    }

    const isPaid = Number(order.balanceDue || 0) <= 0;
    return (
      <div className="tabular-nums font-mono text-right space-y-0.5">
        <div className="font-bold text-slate-900 text-sm">
          ₱{Number(order.grandTotal || 0).toLocaleString()}
        </div>
        <div className="text-xs font-medium">
          {isPaid ? (
            <span className="text-emerald-700">🟢 Paid in Full</span>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span className="text-red-600">
                🔴 ₱{Number(order.balanceDue || 0).toLocaleString()} Due
              </span>
              {renderCustodyBadge(order)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStatus = (order: OrderDirectoryDto) => {
    if (order.isDraft) {
      return (
        <Badge
          variant="outline"
          className="bg-purple-100 text-purple-800 border-purple-300 font-medium"
        >
          📝 Incomplete Draft
        </Badge>
      );
    }

    if (order.isCancelled) {
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 font-medium"
        >
          🛑 Cancelled
        </Badge>
      );
    }

    if (!order.isOwnerConfirmed) {
      return (
        <Badge
          variant="outline"
          className="bg-amber-100 text-amber-900 border-amber-300 font-semibold"
        >
          ⏳ Needs Owner Review
        </Badge>
      );
    }

    const status = (order.routingStatus || "").trim();
    if (status === "Assigned") {
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200 font-medium"
        >
          🛵 Assigned
        </Badge>
      );
    }
    if (status === "Delivered") {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
        >
          🟢 Delivered
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-slate-50 text-slate-700 border-slate-200 font-medium"
      >
        ⚪ Unassigned
      </Badge>
    );
  };

  const renderDataGrid = () => (
    <Card className="bg-white border border-stone-200/90 rounded-xl shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-stone-200 bg-stone-50/80 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-stone-900">
          Order Directory Records
        </CardTitle>
        <div className="text-xs font-mono font-medium text-stone-600 bg-white px-2.5 py-1 rounded-md border border-stone-200 shadow-2xs">
          Showing{" "}
          <strong className="text-stone-900">{displayedOrders.length}</strong>{" "}
          orders
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-100/70 border-b border-stone-200">
              <TableHead className="w-[150px] text-stone-600 font-semibold uppercase tracking-wider text-xs">Order</TableHead>
              <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Customer</TableHead>
              <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Location</TableHead>
              <TableHead className="text-stone-600 font-semibold uppercase tracking-wider text-xs">Target Schedule</TableHead>
              <TableHead className="text-right text-stone-600 font-semibold uppercase tracking-wider text-xs">Total / Balance</TableHead>
              <TableHead className="w-[140px] text-stone-600 font-semibold uppercase tracking-wider text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-stone-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#C81E1E]"></div>
                    <span className="text-sm">Loading orders...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : displayedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-stone-500">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <p className="font-medium text-stone-700">No orders found.</p>
                    <p className="text-xs text-stone-400">
                      Try adjusting your search terms or active tab filter.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayedOrders.map((order: OrderDirectoryDto) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-amber-50/40 transition-colors border-b border-stone-100"
                  onClick={() => handleRowClick(order)}
                >
                  {/* Order Column */}
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-stone-900">
                          #{order.orderReference || order.id}
                        </span>
                        {order.hasRecentEdits && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 font-medium text-[10px] h-4.5 px-1.5"
                          >
                            ✏️ Edited
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 font-normal">
                        by {order.createdBy || "System"}
                      </div>
                    </div>
                  </TableCell>

                  {/* Customer Column */}
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-stone-900">
                          {order.customerName}
                        </span>
                        {order.isTrustedCustomer && (
                          <Badge
                            variant="outline"
                            className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2 uppercase tracking-widest shadow-xs"
                          >
                            👑 VIP
                          </Badge>
                        )}
                        {order.eventType && (
                          <Badge
                            variant="outline"
                            className="bg-stone-50 text-stone-600 border-stone-200 text-[10px] h-4.5 px-1.5"
                          >
                            🎉 {order.eventType}
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-xs text-stone-500 flex items-center gap-1.5">
                        <span>{order.contactNumber || "N/A"}</span>
                        {order.facebookName && (
                          <span className="text-blue-700 font-sans">
                            • 💬 {order.facebookName}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Location Column */}
                  <TableCell>{renderLocation(order)}</TableCell>

                  {/* Target Schedule Column */}
                  <TableCell>
                    {renderTargetSchedule(order)}
                  </TableCell>

                  {/* Total / Balance Column */}
                  <TableCell>{renderFinancialGrid(order)}</TableCell>

                  {/* Status Column */}
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      {renderStatus(order)}
                      {isOwner && !order.isOwnerConfirmed && !order.isDraft && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]"
                          disabled={confirmOwnerMutation.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            confirmOwnerMutation.mutate(order.id, {
                              onSuccess: () => toast.success("Order confirmed by Owner."),
                              onError: () => toast.error("Could not confirm this order."),
                            });
                          }}
                        >
                          ✅ Confirm Order
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header with New Order Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/90 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Master Order Directory
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Search, filter, and inspect financial balances across all active and historical bookings.
          </p>
        </div>

        {/* The New Order Modal */}
        <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-[#C81E1E] hover:bg-[#A81818] text-white shadow-sm h-10 px-4 py-2 cursor-pointer">
            <Plus className="h-4 w-4" /> New Order
          </DialogTrigger>
          {/* Widescreen POS Terminal Modal Shell */}
          <DialogContent className="max-w-5xl xl:max-w-6xl w-full max-h-[92vh] p-0 overflow-hidden gap-0 rounded-xl border-stone-200">
            <DialogHeader className="sr-only">
              <DialogTitle>New POS Order Entry</DialogTitle>
            </DialogHeader>

            {/* Two-Column Ergonomic POS Form */}
            <OrderForm onClose={() => setIsNewOrderOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
        <Input
          placeholder="Search by customer name, FB name, phone, or #OrderRef..."
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          className="bg-white pl-9 h-10 border-stone-300"
        />
      </div>

      {/* 6-Tab Switch Slicing */}
      <Tabs
        value={filterTab}
        onValueChange={(val) => {
          setFilterTab(val);
          if (val !== "balance-due") setBalanceSubFilter("all");
        }}
        className="w-full"
      >
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-stone-200/60 border border-stone-200 rounded-lg">
          <TabsTrigger
            value="upcoming"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
          >
            📅 Upcoming
          </TabsTrigger>
          <TabsTrigger
            value="drafts"
            className="data-[state=active]:bg-white data-[state=active]:text-purple-900 data-[state=active]:shadow-xs flex items-center gap-1.5"
          >
            <span>📝 Drafts</span>
            {draftsCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                {draftsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="recent"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
          >
            ✏️ Recently Modified
          </TabsTrigger>
          <TabsTrigger
            value="balance-due"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
          >
            💵 Balance Due
          </TabsTrigger>
          <TabsTrigger
            value="past-30"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
          >
            ⏳ Past 30 Days
          </TabsTrigger>
          <TabsTrigger
            value="cancelled"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
          >
            🚫 Cancelled
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs"
          >
            📚 All Time
          </TabsTrigger>
        </TabsList>

        {/* Secondary Sub-Pill Bar for Balance Due */}
        {filterTab === "balance-due" && (
          <div
            className="flex flex-wrap items-center gap-2 pt-3 pb-1"
            role="group"
            aria-label="Balance due sub-filters"
          >
            <button
              type="button"
              aria-pressed={balanceSubFilter === "all"}
              onClick={() => setBalanceSubFilter("all")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer",
                balanceSubFilter === "all"
                  ? "bg-amber-600 text-white font-medium shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <span>📋 All Unpaid</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  balanceSubFilter === "all"
                    ? "bg-amber-700 text-amber-100"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {custodyCounts.all}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={balanceSubFilter === "rider"}
              onClick={() => setBalanceSubFilter("rider")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer",
                balanceSubFilter === "rider"
                  ? "bg-amber-600 text-white font-medium shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <span>🛵 Road Cash</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  balanceSubFilter === "rider"
                    ? "bg-amber-700 text-amber-100"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {custodyCounts.rider}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={balanceSubFilter === "drawer"}
              onClick={() => setBalanceSubFilter("drawer")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer",
                balanceSubFilter === "drawer"
                  ? "bg-amber-600 text-white font-medium shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <span>🟡 In Drawer</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  balanceSubFilter === "drawer"
                    ? "bg-amber-700 text-amber-100"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {custodyCounts.drawer}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={balanceSubFilter === "future"}
              onClick={() => setBalanceSubFilter("future")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer",
                balanceSubFilter === "future"
                  ? "bg-amber-600 text-white font-medium shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              <span>📅 Advance</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  balanceSubFilter === "future"
                    ? "bg-amber-700 text-amber-100"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {custodyCounts.future}
              </span>
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 rounded-xl border border-stone-200 bg-white p-2 shadow-xs">
          {[
            ["Cash", "💵 Cash"],
            ["GCash", "📱 GCash"],
            ["Maya", "💚 Maya"],
            ["Bank Transfer", "🏦 Bank Transfer"],
          ].map(([key, label]) => (
            <div
              key={key}
              className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
            >
              <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">
                {label}
              </div>
              <div className="font-mono font-bold text-sm text-stone-900">
                ₱{paymentChannelTotals[key].toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <TabsContent value={filterTab} className="mt-4">
          {renderDataGrid()}
        </TabsContent>
      </Tabs>

      {/* The Slide-Out Safety Drawer */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto overflow-x-hidden bg-[#FAF6F4] p-4 sm:p-6">
          <SheetHeader className="mb-4 p-0">
            <div className="flex flex-col gap-3 pb-3 border-b border-stone-200">
              <div className="space-y-1 min-w-0 pr-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-2xl font-bold font-mono text-stone-900">
                    #{orderDetails?.orderReference || selectedOrder?.orderReference || orderDetails?.id || selectedOrder?.id}
                  </SheetTitle>
                  {/* Semantic Status Pill */}
                  {orderDetails?.isDraft || selectedOrder?.isDraft ? (
                    <Badge
                      variant="outline"
                      className="bg-purple-100 text-purple-800 border-purple-300 font-semibold text-xs"
                    >
                      📝 Incomplete Draft
                    </Badge>
                  ) : orderDetails?.isCancelled || selectedOrder?.isCancelled ? (
                    <Badge
                      variant="outline"
                      className="bg-rose-50 text-rose-700 border-rose-300 font-semibold text-xs"
                    >
                      🛑 Cancelled
                    </Badge>
                  ) : (orderDetails?.routingStatus || selectedOrder?.routingStatus) ===
                    "Delivered" ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-xs"
                    >
                      🟢 Delivered
                    </Badge>
                  ) : (orderDetails?.routingStatus || selectedOrder?.routingStatus) ===
                    "Assigned" ? (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-300 font-semibold text-xs"
                    >
                      🛵 Assigned
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-stone-100 text-stone-700 border-stone-300 font-semibold text-xs"
                    >
                      ⚪ Unassigned
                    </Badge>
                  )}

                  {/* VIP Badge */}
                  {(orderDetails?.isTrustedCustomer ||
                    selectedOrder?.isTrustedCustomer) && (
                    <Badge
                      variant="outline"
                      className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2 uppercase tracking-widest shadow-xs"
                    >
                      👑 VIP
                    </Badge>
                  )}
                </div>
                <SheetDescription className="mt-1 text-xs text-stone-500">
                  {isEditing
                    ? "Modifying the Delivery Time or Item Size will recalculate the kitchen schedule."
                    : "Read-only view. Click 'Edit Details' to unlock modifications."}
                </SheetDescription>
              </div>

              {/* Action Buttons: Responsive row that wraps naturally without side scrolling */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {isOwner &&
                  orderDetails &&
                  !orderDetails.isOwnerConfirmed &&
                  !orderDetails.isDraft && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={confirmOwnerMutation.isPending}
                      className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() =>
                        confirmOwnerMutation.mutate(orderDetails.id, {
                          onSuccess: () => toast.success("Order confirmed by Owner."),
                          onError: () => toast.error("Could not confirm this order."),
                        })
                      }
                    >
                      ✅ Confirm Order
                    </Button>
                  )}
                {orderDetails && !isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 gap-1.5 border-stone-300 bg-white text-stone-700 hover:bg-stone-100 shadow-2xs"
                    onClick={handleShareDetails}
                  >
                    📋 Share Details
                  </Button>
                )}
                {selectedOrder && (
                  <>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs"
                      size="sm"
                      onClick={() => setIsPaymentOpen(true)}
                    >
                      💳 Log Payment
                    </Button>
                    <Button
                      variant={isEditing ? "outline" : "default"}
                      size="sm"
                      className={cn(
                        "h-9 text-xs",
                        !isEditing && "bg-[#C81E1E] hover:bg-[#A81818] text-white"
                      )}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? "Cancel Edit" : "Edit Details"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetHeader>

          {selectedOrder && (
            <div className="mt-4">
              {isEditing ? (
                <EditOrderForm
                  order={orderDetails}
                  onClose={() => setIsSheetOpen(false)}
                />
              ) : isDetailsLoading ? (
                <div className="py-16 text-center text-stone-500 animate-pulse">
                  Pulling heavy dossier from the vault...
                </div>
              ) : orderDetails ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Draft Inquiry Informational Banner */}
                  {(orderDetails?.isDraft || selectedOrder?.isDraft) && (
                    <div className="bg-purple-50 border border-purple-300 text-purple-900 rounded-lg p-3.5 text-xs flex items-start gap-2.5 shadow-xs">
                      <span className="text-base shrink-0">📝</span>
                      <div className="space-y-0.5">
                        <div className="font-bold text-purple-950">Tentative Inquiry</div>
                        <div className="leading-relaxed text-purple-800">
                          This order is an unconfirmed draft. No kitchen schedule has been generated and no freezer inventory is locked.
                        </div>
                      </div>
                    </div>
                  )}

                  {!orderDetails.isDraft && !orderDetails.isOwnerConfirmed && (
                    <div className="bg-amber-100 border border-amber-300 text-amber-950 rounded-lg p-3 text-xs font-semibold flex items-center justify-between gap-3">
                      <span>⏳ Needs Owner Review</span>
                      {isOwner && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          disabled={confirmOwnerMutation.isPending}
                          onClick={() => confirmOwnerMutation.mutate(orderDetails.id)}
                        >
                          ✅ Confirm Order
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Card 1: Logistics & Contact */}
                  <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-xs">
                    <h3 className="font-semibold text-lg border-b border-stone-200 pb-2 mb-3 text-stone-900">
                      Customer & Logistics
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <p className="text-stone-500">Name</p>
                        <div className="font-medium text-base text-stone-900 flex items-center gap-2 flex-wrap">
                          {orderDetails.customerName}
                          {orderDetails.isTrustedCustomer && (
                            <Badge
                              variant="outline"
                              className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] h-5 px-2 uppercase tracking-widest shadow-xs"
                            >
                              👑 VIP
                            </Badge>
                          )}
                          {orderDetails.eventType && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-900 border-amber-200 text-xs"
                            >
                              🎉 {orderDetails.eventType}
                            </Badge>
                          )}
                          {orderDetails.source && (
                            <Badge
                              variant="outline"
                              className="bg-stone-50 text-stone-600 border-stone-200 text-xs"
                            >
                              📥 {orderDetails.source}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-stone-500">Contact Number</p>
                        <p className="font-medium text-stone-800">
                          {orderDetails.contactNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-500">FB / Messenger Name</p>
                        <p className="font-medium text-blue-800">
                          {orderDetails.facebookName || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-500">Delivery Target</p>
                        <p className="font-medium text-amber-900">
                          {orderDetails.targetDeliveryTime
                            ? new Date(
                                orderDetails.targetDeliveryTime
                              ).toLocaleString()
                            : "📅 Date Pending"}
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-500">Rider Departure (Anchor)</p>
                        <p className="font-medium text-stone-800 font-mono text-xs">
                          {orderDetails.riderDepartureTime
                            ? new Date(
                                orderDetails.riderDepartureTime
                              ).toLocaleString()
                            : orderDetails.targetDeliveryTime
                              ? new Date(
                                  orderDetails.targetDeliveryTime
                                ).toLocaleString()
                              : "📅 Anchor Pending"}
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-500">Delivery Method</p>
                        <p className="font-medium text-stone-800 flex items-center gap-1">
                          {Number(orderDetails?.fulfillment) === 0 ||
                          String(orderDetails?.fulfillment).toLowerCase() === "pickup"
                            ? "🏪 Walk-in Store Pickup"
                            : Number(orderDetails?.fulfillment) === 2 ||
                              String(orderDetails?.fulfillment).toLowerCase() === "lalamove"
                            ? "📦 Lalamove Courier"
                            : "🚚 Standard Delivery"}
                        </p>
                      </div>

                      <div>
                        <p className="text-stone-500">Address / Location</p>
                        <p className="font-medium text-stone-800">
                          {orderDetails?.deliveryAddress ||
                            orderDetails?.location || (
                              Number(orderDetails?.fulfillment) === 0 ? (
                                <span className="text-stone-500">Store Pickup</span>
                              ) : (
                                <span className="text-purple-700 italic font-medium">
                                  📍 Venue TBD / Unset
                                </span>
                              )
                            )}
                        </p>
                        {orderDetails?.landmark && (
                          <p className="text-xs text-amber-800 font-medium mt-0.5">
                            🧭 Landmark: {orderDetails.landmark}
                          </p>
                        )}
                      </div>

                      {/* Dedicated Courier / Handover Status section */}
                      <div className="col-span-2 mt-1 pt-3 border-t border-stone-100">
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                          Courier / Handover Status
                        </p>
                        {Number(orderDetails.fulfillment) === 1 ? (
                          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-stone-900">
                                {orderDetails.assignedRiderName ? (
                                  <>
                                    🛵 {orderDetails.assignedRiderName}
                                    {orderDetails.assignedRiderPhone ? (
                                      <span className="text-stone-500 font-normal">
                                        {" "}
                                        • {orderDetails.assignedRiderPhone}
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-stone-600 font-medium">
                                    Pending Rider Assignment
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-stone-500">
                                Freelance Delivery Courier
                              </p>
                            </div>
                            <div>
                              {orderDetails.assignedRiderName ? (
                                orderDetails.routingStatus === "Assigned" ||
                                orderDetails.routingStatus === "Delivered" ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 border-blue-300 font-medium"
                                  >
                                    🛵 Out for Delivery
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-stone-100 text-stone-700 border-stone-300 font-medium"
                                  >
                                    ⚪ Pending Dispatch
                                  </Badge>
                                )
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-700 border-amber-300 font-medium"
                                >
                                  ⚪ Pending Rider Assignment
                                </Badge>
                              )}
                            </div>
                          </div>
                        ) : Number(orderDetails.fulfillment) === 2 ? (
                          <div className="flex items-center justify-between p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-stone-900">
                                📦 Customer-Booked Lalamove Courier
                              </p>
                              <p className="text-xs text-stone-500">
                                Third-Party Courier App Handover
                              </p>
                            </div>
                            <div>
                              {Number(
                                orderDetails.balanceDue ??
                                  (Number(orderDetails.grandTotal || 0) -
                                    Number(orderDetails.downpayment || 0))
                              ) <= 0 ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold"
                                >
                                  🟢 Cleared for Release
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-rose-100 text-rose-800 border-rose-300 font-semibold"
                                >
                                  🛑 Hold: Unpaid Balance
                                </Badge>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-stone-900">
                                🏪 Walk-in Store Pickup
                              </p>
                              <p className="text-xs text-stone-500">
                                Direct Counter Handover
                              </p>
                            </div>
                            <div>
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium"
                              >
                                Ready for Counter Pickup
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>

                      {orderDetails.isCancelled && (
                        <div className="col-span-2 bg-rose-50 p-3 rounded-lg border border-rose-200 mt-2">
                          <p className="text-xs text-rose-800 font-bold uppercase mb-1">
                            Booking Voided / Cancelled
                          </p>
                          <p className="text-sm text-rose-900 font-medium">
                            Reason: {orderDetails.cancellationReason || "No cancellation reason logged."}
                          </p>
                        </div>
                      )}

                      {orderDetails.remarks && (
                        <div className="col-span-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                          <p className="text-xs text-amber-800 font-bold uppercase mb-1">
                            Kitchen & Prep Instructions
                          </p>
                          <p className="text-sm text-stone-800">
                            {orderDetails.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 1B: Customer Intelligence & Feedback (Preferences & Complaint Radar) */}
                  <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base text-stone-900">
                          🧠 Customer Intelligence & Feedback
                        </h3>
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-900 border-amber-300 font-semibold text-xs"
                        >
                          ⭐ {orderDetails.customerTotalOrdersCount || 1}{" "}
                          {(orderDetails.customerTotalOrdersCount || 1) === 1
                            ? "Order"
                            : "Orders"}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-stone-300 text-stone-700 hover:bg-stone-100"
                        onClick={() => {
                          setDraftPreferences(
                            orderDetails.customerPreferences || ""
                          );
                          setDraftComplaints(
                            orderDetails.customerComplaintHistory || ""
                          );
                          setIsNotesEditorOpen((prev) => !prev);
                        }}
                      >
                        {isNotesEditorOpen
                          ? "Close Editor"
                          : "✏️ Update Customer Notes"}
                      </Button>
                    </div>

                    {!isNotesEditorOpen ? (
                      <div className="space-y-2.5 text-sm">
                        <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200/80">
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-1">
                            Known Preferences
                          </p>
                          <p className="text-sm text-blue-950 font-medium">
                            💡{" "}
                            {orderDetails.customerPreferences ||
                              "None recorded"}
                          </p>
                        </div>

                        <div
                          className={cn(
                            "p-3 rounded-lg border",
                            orderDetails.customerComplaintHistory
                              ? "bg-rose-50 border-rose-300"
                              : "bg-stone-50 border-stone-200"
                          )}
                        >
                          <p
                            className={cn(
                              "text-xs font-bold uppercase tracking-wider mb-1",
                              orderDetails.customerComplaintHistory
                                ? "text-rose-800"
                                : "text-stone-500"
                            )}
                          >
                            Logged Complaints / Issues
                          </p>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              orderDetails.customerComplaintHistory
                                ? "text-rose-900 font-semibold"
                                : "text-stone-600"
                            )}
                          >
                            ⚠️{" "}
                            {orderDetails.customerComplaintHistory ||
                              "No issues logged"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 bg-stone-50 p-3.5 rounded-lg border border-stone-200">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-blue-900 block">
                            💡 Customer Preferences (e.g. Extra crispy skin, Walang dinuguan, Liver sauce only)
                          </label>
                          <Textarea
                            rows={2}
                            placeholder="Record recurring customer preferences..."
                            value={draftPreferences}
                            onChange={(e) =>
                              setDraftPreferences(e.target.value)
                            }
                            className="bg-white text-xs border-stone-300 resize-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-rose-800 block">
                            ⚠️ Logged Complaints / Past Issues (Surfaces high-priority alert on next POS booking)
                          </label>
                          <Textarea
                            rows={2}
                            placeholder="Record past delivery delays, sauce issues, or special handling warnings..."
                            value={draftComplaints}
                            onChange={(e) =>
                              setDraftComplaints(e.target.value)
                            }
                            className="bg-white text-xs border-stone-300 resize-none"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setIsNotesEditorOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={updateCustomerNotesMutation.isPending}
                            className="h-8 text-xs bg-[#C81E1E] hover:bg-[#A81818] text-white"
                            onClick={() => {
                              updateCustomerNotesMutation.mutate(
                                {
                                  id: orderDetails.customerProfileId,
                                  phone: orderDetails.contactNumber,
                                  customerName: orderDetails.customerName,
                                  facebookName: orderDetails.facebookName,
                                  preferences: draftPreferences.trim(),
                                  complaintHistory: draftComplaints.trim(),
                                  isVip: Boolean(orderDetails.isTrustedCustomer),
                                },
                                {
                                  onSuccess: () => {
                                    toast.success(
                                      "Customer intelligence notes updated!"
                                    );
                                    setIsNotesEditorOpen(false);
                                  },
                                  onError: (err: any) => {
                                    toast.error(
                                      err?.response?.data?.message ||
                                        "Failed to update customer notes."
                                    );
                                  },
                                }
                              );
                            }}
                          >
                            {updateCustomerNotesMutation.isPending
                              ? "Saving..."
                              : "Save Notes"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Order Manifest & Add-ons */}
                  <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-xs">
                    <h3 className="font-semibold text-lg border-b border-stone-200 pb-2 mb-3 text-stone-900">
                      Order Manifest
                    </h3>
                    {displayedFreebiesSummary && (
                      <Badge
                        variant="outline"
                        className={`mb-3 h-auto max-w-full whitespace-normal break-words py-1 text-left font-semibold leading-snug ${
                          displayedFreebiesSummary === "🚫 No Freebies"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : displayedFreebiesSummary.includes("Raw Innards") ||
                                displayedFreebiesSummary.includes(":")
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {displayedFreebiesSummary}
                      </Badge>
                    )}
                    <div className="space-y-3">
                      {orderDetails.orderItems?.map(
                        (item: any, index: number) => (
                          <div
                            key={index}
                            className="flex justify-between items-center bg-stone-50 p-2.5 rounded-lg border border-stone-100"
                          >
                            <div>
                              <p className="font-medium text-sm text-stone-800">
                                {item.quantity}x{" "}
                                {item.itemCategory?.name || "Lechon Size"}
                              </p>
                            </div>

                            <p className="font-semibold text-sm text-stone-900 font-mono">
                              {item.totalPrice > 0 ? (
                                `₱${item.totalPrice.toLocaleString()}`
                              ) : orderDetails.orderItems?.length === 1 ? (
                                `₱${(orderDetails.price || 0).toLocaleString()}`
                              ) : (
                                <span className="text-stone-400 italic text-xs font-sans">
                                  Included in Subtotal
                                </span>
                              )}
                            </p>
                          </div>
                        )
                      )}

                      {orderDetails.addOns && (
                        <div className="pt-3 border-t border-dashed border-stone-200 mt-2">
                          <p className="text-xs text-stone-500 uppercase mb-1 tracking-wider">
                            Add-Ons Requested
                          </p>
                          <p className="text-sm font-medium text-stone-800">
                            {orderDetails.addOns}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Exact Financial Splits */}
                  <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-xs">
                    <h3 className="font-semibold text-lg border-b border-stone-200 pb-2 mb-3 text-stone-900">
                      Financial Splits
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-stone-600">
                        <span>Subtotal (Lechon):</span>
                        <span className="font-mono">
                          ₱{orderDetails.price?.toLocaleString() || 0}
                        </span>
                      </div>

                      {(orderDetails.grandTotal || 0) -
                        (orderDetails.price || 0) -
                        (orderDetails.deliveryFee || 0) +
                        (orderDetails.discount || 0) >
                        0 && (
                        <div className="flex justify-between text-amber-800 font-medium">
                          <span>Add-Ons:</span>
                          <span className="font-mono">
                            ₱
                            {(
                              (orderDetails.grandTotal || 0) -
                              (orderDetails.price || 0) -
                              (orderDetails.deliveryFee || 0) +
                              (orderDetails.discount || 0)
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-stone-600 border-b border-stone-200 pb-2">
                        <span>Delivery Fee:</span>
                        <span className="font-mono">
                          ₱{orderDetails.deliveryFee?.toLocaleString() || 0}
                        </span>
                      </div>

                      {orderDetails.discount > 0 && (
                        <div className="flex justify-between text-rose-600 pt-1">
                          <span>Discount Applied:</span>
                          <span className="font-mono">
                            - ₱{orderDetails.discount?.toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between font-semibold text-stone-900 pt-1">
                        <span>Grand Total:</span>
                        <span className="font-mono">
                          ₱{orderDetails.grandTotal?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Downpayment:</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono">
                            - ₱{orderDetails.downpayment?.toLocaleString() || 0}
                          </span>
                          {Number(orderDetails.downpayment || 0) > 0 && (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-800"
                            >
                              {orderDetails.downpaymentMethod === "Cash"
                                ? "💵"
                                : orderDetails.downpaymentMethod === "Maya"
                                  ? "💚"
                                  : orderDetails.downpaymentMethod === "Bank Transfer"
                                    ? "🏦"
                                    : "📱"}{" "}
                              {orderDetails.downpaymentMethod || "GCash"}
                            </Badge>
                          )}
                        </span>
                      </div>
                      {orderDetails.paymentLogs?.length > 0 && (
                        <div className="space-y-1 border-t border-stone-100 pt-2 text-xs">
                          <p className="font-semibold uppercase tracking-wide text-stone-500">
                            Payment history
                          </p>
                          {orderDetails.paymentLogs.map((payment: any) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between text-stone-600"
                            >
                              <span>
                                {payment.paymentMethod === "Cash"
                                  ? "💵"
                                  : payment.paymentMethod === "Maya"
                                    ? "💚"
                                    : payment.paymentMethod === "Bank Transfer"
                                      ? "🏦"
                                      : "📱"}{" "}
                                {payment.paymentMethod}
                              </span>
                              <span className="font-mono font-semibold">
                                ₱{Number(payment.amount || 0).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between text-rose-600 font-bold text-lg border-t border-stone-200 pt-2 mt-2">
                        <span>Balance to Collect:</span>
                        <span className="font-mono">
                          ₱
                          {(
                            (orderDetails.grandTotal || 0) -
                            (orderDetails.downpayment || 0)
                          ).toLocaleString()}
                        </span>
                      </div>

                      {/* Physical Cash Custody / Manifest Deep-Link Action */}
                      {(orderDetails.settlementCustodyStatus === "InStaffDrawer" ||
                        selectedOrder?.settlementCustodyStatus === "InStaffDrawer" ||
                        orderDetails.routingStatus === "Assigned" ||
                        selectedOrder?.routingStatus === "Assigned") && (
                        <div className="mt-3 pt-3 border-t border-stone-200 flex items-center justify-between bg-amber-50/80 p-3 rounded-lg border border-amber-200">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                              {(orderDetails.settlementCustodyStatus || selectedOrder?.settlementCustodyStatus) === "InStaffDrawer" ? (
                                <>
                                  <span>🟡</span>
                                  <span>In Staff Drawer</span>
                                </>
                              ) : (
                                <>
                                  <span>🛵</span>
                                  <span>In Rider Custody</span>
                                </>
                              )}
                            </p>
                            <p className="text-[11px] text-amber-800">
                              Physical cash custody is active. Reconcile or settle via Manifest.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium border-amber-300 text-amber-900 hover:bg-amber-100 bg-white shadow-2xs gap-1 cursor-pointer shrink-0"
                            onClick={() => {
                              setIsSheetOpen(false);
                              navigate("/manifest");
                            }}
                          >
                            View in Manifest ➔
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 4: Security Audit Log */}
                  <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-xs">
                    <h3 className="font-semibold text-lg border-b border-stone-200 pb-2 mb-4 text-stone-900 flex items-center gap-2">
                      🛡️ Audit Log
                    </h3>
                    <div className="space-y-4">
                      {isAuditLoading ? (
                        <p className="text-sm text-stone-500 animate-pulse">
                          Decrypting logs...
                        </p>
                      ) : auditLogs?.length === 0 ? (
                        <p className="text-sm text-stone-500 italic">
                          No modifications logged. Order is in its original
                          state.
                        </p>
                      ) : (
                        <div className="relative border-l-2 border-stone-200 ml-3 space-y-6">
                          {auditLogs?.map((log: any) => (
                            <div key={log.id} className="relative ml-6">
                              <span className="absolute flex items-center justify-center w-3 h-3 bg-stone-400 rounded-full -left-[31px] ring-4 ring-white mt-1"></span>

                              <p className="text-xs text-stone-500 font-semibold tracking-wider uppercase">
                                {new Date(log.timestamp).toLocaleString()} •{" "}
                                {log.changedBy}
                              </p>
                              <p className="text-sm text-stone-800 mt-1 font-medium bg-stone-50 p-2 rounded border border-stone-100">
                                {log.changes}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions / In-Dossier Cancellation Gate */}
                  {!orderDetails.isCancelled &&
                    orderDetails.routingStatus !== "Delivered" && (
                      <div className="pt-2 flex justify-end">
                        <Button
                          variant="outline"
                          className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 shadow-2xs font-medium"
                          onClick={() => {
                            setCancellationReason("");
                            setIsCancelDialogOpen(true);
                          }}
                        >
                          🚫 Cancel Order
                        </Button>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center text-rose-600 py-10">
                  Data unavailable.
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

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
                if (!selectedOrder) return;
                paymentMutation.mutate(
                  {
                    orderId: selectedOrder.id,
                    amount: Number(paymentAmount),
                    paymentProvider: paymentMethod,
                  },
                  {
                    onSuccess: () => {
                      setIsPaymentOpen(false);
                      setPaymentAmount("");
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

      {/* In-Dossier Cancellation Confirmation Modal */}
      <AlertDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
      >
        <AlertDialogContent className="sm:max-w-md rounded-xl border-stone-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-stone-900">
              Cancel Order #{orderDetails?.orderReference || selectedOrder?.orderReference || orderDetails?.id || selectedOrder?.id}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-stone-600">
              This action will void the booking, immediately release the
              reserved pig back into sellable inventory, and log your name in
              the audit ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Select Preset Reason
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_CANCEL_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCancellationReason(preset)}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-full border transition-all cursor-pointer font-medium",
                    cancellationReason === preset
                      ? "bg-rose-100 border-rose-300 text-rose-800 shadow-2xs"
                      : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 block">
                Custom or Adjusted Notes <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Enter detailed reason for voiding this booking..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                className="resize-none bg-white text-sm border-stone-300"
                required
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsCancelDialogOpen(false)}>
              Keep Booking
            </AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={
                cancelOrderMutation.isPending || !cancellationReason.trim()
              }
              onClick={() => {
                const targetId = orderDetails?.id || selectedOrder?.id;
                if (!targetId) return;
                cancelOrderMutation.mutate({
                  orderId: targetId,
                  reason: cancellationReason.trim(),
                });
              }}
            >
              {cancelOrderMutation.isPending
                ? "Cancelling..."
                : "Confirm Cancellation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
