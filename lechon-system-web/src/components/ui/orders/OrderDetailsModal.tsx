/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useOrderAuditLogs } from "@/hooks/useOrderAuditLogs";
import { useLogPayment } from "@/hooks/useLogPayment";
import { useVoidPaymentMutation } from "@/hooks/useVoidPayment";
import { useAssignRider } from "@/hooks/useLogistics";
import { useRidersQuery } from "@/hooks/useRiders";
import { WalkInBadge } from "@/components/WalkInBadge";
import { generateBookingConfirmation } from "@/utils/messengerTemplates";
import { sanitizeFreebiesSummary } from "@/utils/freebiesHelper";
import { sanitizeMojibake } from "@/utils/sanitizeDisplayText";
import EditOrderForm from "@/components/ui/orders/EditOrderForm";
import apiClient from "@/services/apiClient";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Bike,
  CreditCard,
  Edit3,
  Copy,
  History,
  AlertTriangle,
} from "lucide-react";

export interface OrderDetailsModalProps {
  orderId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OrderDetailsModal({
  orderId,
  isOpen,
  onClose,
}: OrderDetailsModalProps) {
  const { isOwner, user } = useAuth();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [paymentAmount2, setPaymentAmount2] = useState<number | "">("");
  const [paymentMethod2, setPaymentMethod2] = useState("Cash");
  const [referenceNumber2, setReferenceNumber2] = useState("");

  const [isRiderAssignmentOpen, setIsRiderAssignmentOpen] = useState(false);
  const [selectedRiderName, setSelectedRiderName] = useState("");
  const [customRiderName, setCustomRiderName] = useState("");

  const [paymentToVoid, setPaymentToVoid] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Data fetching
  const { data: orderDetails, isLoading: isDetailsLoading } = useOrderDetails(orderId);
  const { data: auditLogs, isLoading: isAuditLoading } = useOrderAuditLogs(orderId);
  const { data: registeredRiders = [] } = useRidersQuery();

  // Mutations
  const paymentMutation = useLogPayment();
  const voidPaymentMutation = useVoidPaymentMutation();
  const assignRiderMutation = useAssignRider();

  const confirmOwnerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.patch(`/orders/${id}/owner-confirm`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Order confirmed by Owner!");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["manifest"] });
    },
    onError: () => toast.error("Failed to confirm order."),
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["manifest"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["riders"] }),
      queryClient.invalidateQueries({ queryKey: ["orders", orderId, "audit-logs"] }),
    ]);
  };

  const handleShareDetails = () => {
    if (!orderDetails) return;
    const msg = generateBookingConfirmation(orderDetails);
    navigator.clipboard.writeText(msg).then(() => {
      toast.success("Booking details copied to clipboard!");
    });
  };

  const handleAssignRider = () => {
    if (!orderId) return;
    const riderName = (customRiderName || selectedRiderName).trim();
    if (!riderName) {
      toast.error("Please select or enter a rider name.");
      return;
    }
    assignRiderMutation.mutate(
      { orderIds: [orderId], riderName, vehicleType: "Motorcycle" },
      {
        onSuccess: async () => {
          await invalidateAll();
          setIsRiderAssignmentOpen(false);
          setCustomRiderName("");
          toast.success(`${riderName} assigned to this delivery.`);
        },
        onError: () => toast.error("Could not assign this rider."),
      }
    );
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;

    if (isSplitPayment) {
      const amt1 = Number(paymentAmount);
      const amt2 = Number(paymentAmount2);
      if (!amt1 || amt1 <= 0 || !amt2 || amt2 <= 0) {
        toast.error("Please enter valid amounts for both split payments.");
        return;
      }
      paymentMutation.mutate(
        {
          orderId,
          splits: [
            { amount: amt1, paymentMethod, referenceNumber },
            { amount: amt2, paymentMethod: paymentMethod2, referenceNumber: referenceNumber2 },
          ],
        },
        {
          onSuccess: async () => {
            await invalidateAll();
            setIsPaymentOpen(false);
            setPaymentAmount("");
            setPaymentAmount2("");
            setReferenceNumber("");
            setReferenceNumber2("");
          },
        }
      );
    } else {
      const amt = Number(paymentAmount);
      if (!amt || amt <= 0) {
        toast.error("Please enter a valid payment amount.");
        return;
      }
      paymentMutation.mutate(
        {
          orderId,
          amount: amt,
          paymentProvider: paymentMethod,
          referenceNumber,
        },
        {
          onSuccess: async () => {
            await invalidateAll();
            setIsPaymentOpen(false);
            setPaymentAmount("");
            setReferenceNumber("");
          },
        }
      );
    }
  };

  const handleVoidPaymentSubmit = () => {
    if (!paymentToVoid || !orderId) return;
    if (!voidReason.trim()) {
      toast.error("Please provide a reason for voiding this payment.");
      return;
    }

    voidPaymentMutation.mutate(
      {
        orderId,
        paymentLogId: paymentToVoid.id,
        reason: voidReason.trim(),
        voidedBy: user?.username || "owner",
      },
      {
        onSuccess: async () => {
          toast.success("Payment voided successfully.");
          await invalidateAll();
          setPaymentToVoid(null);
          setVoidReason("");
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || "Failed to void payment.");
        },
      }
    );
  };

  const freebiesSummary = useMemo(() => {
    if (!orderDetails) return "";
    return sanitizeFreebiesSummary(orderDetails.freebiesSummary);
  }, [orderDetails]);
  const sanitizedRemarks = sanitizeMojibake(orderDetails?.remarks);
  const heldByStaffAmount = Number(orderDetails?.heldByStaffAmount || 0);
  const heldPaymentMethod = String(orderDetails?.heldPaymentMethod || "")
    .trim()
    .toLowerCase();
  const hasPhysicalStaffCustody =
    orderDetails?.settlementCustodyStatus === "InStaffDrawer" &&
    heldByStaffAmount > 0 &&
    (heldPaymentMethod === "" || heldPaymentMethod === "cash");

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) { setIsEditing(false); onClose(); } }}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto overflow-x-hidden bg-[#FAF6F4] p-4 sm:p-6">
          <SheetHeader className="mb-4 p-0">
            <div className="flex flex-col gap-3 pb-3 border-b border-stone-200">
              <div className="space-y-1 min-w-0 pr-8">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-2xl font-black font-mono text-stone-900">
                    #{orderDetails?.orderReference || orderId}
                  </SheetTitle>
                  {orderDetails && (
                    <WalkInBadge
                      source={orderDetails.source}
                      customerName={orderDetails.customerName}
                      facebookName={orderDetails.facebookName}
                    />
                  )}
                  {orderDetails?.isTrustedCustomer && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold"
                    >
                      👑 VIP
                    </Badge>
                  )}
                  {orderDetails?.isDraft ? (
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-xs font-semibold">
                      📝 Draft
                    </Badge>
                  ) : orderDetails?.isCancelled ? (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-xs font-semibold">
                      🛑 Cancelled
                    </Badge>
                  ) : orderDetails?.routingStatus === "Delivered" ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-semibold">
                      🟢 Delivered
                    </Badge>
                  ) : orderDetails?.routingStatus === "Assigned" ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs font-semibold">
                      🛵 Assigned
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-stone-100 text-stone-700 border-stone-300 text-xs font-semibold">
                      ⚪ Unassigned
                    </Badge>
                  )}
                </div>
                <SheetDescription className="text-xs text-stone-500">
                  {isEditing
                    ? "Editing order properties and recalculating schedule."
                    : "Complete customer booking dossier, payment history, and fulfillment tracking."}
                </SheetDescription>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {isOwner && orderDetails && !orderDetails.isOwnerConfirmed && !orderDetails.isDraft && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmOwnerMutation.isPending}
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
                    onClick={() => confirmOwnerMutation.mutate(orderDetails.id)}
                  >
                    ✅ Confirm Order
                  </Button>
                )}
                {orderDetails && !isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5 border-stone-300 bg-white text-stone-700 hover:bg-stone-100 shadow-2xs font-semibold cursor-pointer"
                    onClick={handleShareDetails}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy for Messenger</span>
                  </Button>
                )}
                {orderDetails && !orderDetails.isCancelled && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                    size="sm"
                    onClick={() => {
                      setPaymentAmount(orderDetails.balanceDue > 0 ? orderDetails.balanceDue : "");
                      setIsPaymentOpen(true);
                    }}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Log Payment</span>
                  </Button>
                )}
                {orderDetails && (
                  <Button
                    variant={isEditing ? "outline" : "default"}
                    size="sm"
                    className={`h-8 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 ${
                      !isEditing ? "bg-[#C81E1E] hover:bg-[#A81818] text-white" : ""
                    }`}
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? "Close Editor" : "Edit Details"}</span>
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Body Content */}
          {isDetailsLoading ? (
            <div className="py-20 text-center text-stone-500 animate-pulse space-y-2">
              <div className="text-2xl">📋</div>
              <div className="font-medium text-sm">Pulling dossier from vault...</div>
            </div>
          ) : isEditing && orderDetails ? (
            <div className="mt-2">
              <EditOrderForm
                order={orderDetails}
                onClose={() => {
                  setIsEditing(false);
                  invalidateAll();
                }}
              />
            </div>
          ) : orderDetails ? (
            <div className="space-y-4 text-xs sm:text-sm animate-in fade-in duration-200">
              {/* CARD 1: CUSTOMER & LOGISTICS */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200/90 shadow-2xs space-y-3">
                <h3 className="font-bold text-base border-b border-stone-200 pb-2 text-stone-900 flex items-center gap-2">
                  <span>📍</span>
                  <span>Customer &amp; Logistics</span>
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-stone-500 text-[11px] font-semibold uppercase">Customer Name</p>
                    <p className="font-bold text-stone-900 text-sm mt-0.5">{orderDetails.customerName}</p>
                  </div>
                  <div>
                    <p className="text-stone-500 text-[11px] font-semibold uppercase">Contact Number</p>
                    <p className="font-mono font-medium text-stone-800 mt-0.5">{orderDetails.contactNumber || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-stone-500 text-[11px] font-semibold uppercase">FB / Messenger Name</p>
                    <p className="font-medium text-blue-800 mt-0.5">{orderDetails.facebookName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-stone-500 text-[11px] font-semibold uppercase">Target Schedule</p>
                    <p className="font-semibold text-amber-900 mt-0.5">
                      {orderDetails.targetDeliveryTime
                        ? new Date(orderDetails.targetDeliveryTime).toLocaleString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "📅 Date Pending"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-stone-500 text-[11px] font-semibold uppercase">Delivery Address</p>
                    <p className="font-medium text-stone-800 mt-0.5">
                      {orderDetails.deliveryAddress || (
                        Number(orderDetails.fulfillment) === 0 ? "Store Counter Pickup" : "Venue TBD"
                      )}
                    </p>
                    {orderDetails.landmark && (
                      <p className="text-xs text-amber-800 font-medium mt-1">
                        🧭 Landmark: {orderDetails.landmark}
                      </p>
                    )}
                  </div>
                </div>

                {/* Courier / Dispatch Status */}
                <div className="pt-2 border-t border-stone-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                    <div>
                      <p className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                        <Bike className="w-3.5 h-3.5 text-amber-700" />
                        <span>
                          {orderDetails.assignedRiderName
                            ? `Rider: ${orderDetails.assignedRiderName}`
                            : Number(orderDetails.fulfillment) === 0
                              ? "🏪 Store Counter Pickup"
                              : Number(orderDetails.fulfillment) === 2
                                ? "📦 Lalamove Courier"
                                : "Unassigned Rider"}
                        </span>
                      </p>
                    </div>
                    {Number(orderDetails.fulfillment) === 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-50 font-semibold cursor-pointer"
                        onClick={() => {
                          setSelectedRiderName(orderDetails.assignedRiderName || "");
                          setIsRiderAssignmentOpen(!isRiderAssignmentOpen);
                        }}
                      >
                        {isRiderAssignmentOpen ? "Cancel" : "Assign / Change Rider"}
                      </Button>
                    )}
                  </div>

                  {isRiderAssignmentOpen && (
                    <div className="mt-2 p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={selectedRiderName}
                          onChange={(e) => {
                            setSelectedRiderName(e.target.value);
                            if (e.target.value) setCustomRiderName("");
                          }}
                          className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs"
                        >
                          <option value="">Select registered rider</option>
                          {registeredRiders.filter((r) => r.isActive).map((r) => (
                            <option key={r.id} value={r.fullName}>
                              {r.fullName}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={customRiderName}
                          onChange={(e) => {
                            setCustomRiderName(e.target.value);
                            if (e.target.value) setSelectedRiderName("");
                          }}
                          placeholder="Or type custom rider name"
                          className="h-8 bg-white text-xs"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={assignRiderMutation.isPending}
                          onClick={handleAssignRider}
                          className="h-7 text-xs bg-blue-700 hover:bg-blue-800 text-white font-bold"
                        >
                          {assignRiderMutation.isPending ? "Assigning..." : "Save Rider"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {sanitizedRemarks && (
                  <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs">
                    <p className="font-bold text-amber-900 uppercase tracking-wide text-[10px]">Prep Remarks</p>
                    <p className="text-stone-800 mt-0.5">{sanitizedRemarks}</p>
                  </div>
                )}
              </div>

              {/* CARD 2: ITEMS ORDERED & MANIFEST */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200/90 shadow-2xs space-y-3">
                <h3 className="font-bold text-base border-b border-stone-200 pb-2 text-stone-900 flex items-center gap-2">
                  <span>🍖</span>
                  <span>Order Items</span>
                </h3>

                {freebiesSummary && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-semibold py-1">
                    {freebiesSummary}
                  </Badge>
                )}

                <div className="space-y-2">
                  {orderDetails.orderItems?.map((item: any, idx: number) => {
                    const isUpgraded = item.fulfilledCategoryName && item.fulfilledItemCategoryId !== item.itemCategoryId;
                    return (
                      <div key={idx} className="flex justify-between items-center p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                        <div>
                          <p className="font-bold text-stone-900 text-sm">
                            {item.quantity}x {item.itemCategory?.name || "Lechon"}
                          </p>
                          {item.customWeightDisplay && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded mt-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Custom: {item.customWeightDisplay}
                            </span>
                          )}
                          {isUpgraded && (
                            <span className="block text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded mt-1">
                              🔄 Fulfilled as: {item.fulfilledCategoryName}
                            </span>
                          )}
                        </div>
                        <div className="text-right font-mono font-bold text-stone-900 text-sm">
                          ₱{Number(item.totalPrice || orderDetails.price || 0).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}

                  {orderDetails.addOns && (
                    <div className="pt-2 border-t border-dashed border-stone-200 text-xs text-stone-700">
                      <span className="font-bold text-stone-900">Add-Ons: </span>
                      <span>{orderDetails.addOns}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 3: FINANCIAL LEDGER & PAYMENT HISTORY */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200/90 shadow-2xs space-y-3">
                <h3 className="font-bold text-base border-b border-stone-200 pb-2 text-stone-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>💵</span>
                    <span>Financial Ledger</span>
                  </span>
                  <span className="font-mono text-sm text-stone-500">
                    Grand Total: ₱{Number(orderDetails.grandTotal || 0).toLocaleString()}
                  </span>
                </h3>

                <div className="space-y-1.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>Lechon Subtotal:</span>
                    <span className="font-mono font-medium">₱{Number(orderDetails.price || 0).toLocaleString()}</span>
                  </div>
                  {Number(orderDetails.deliveryFee || 0) > 0 && (
                    <div className="flex justify-between text-stone-600">
                      <span>Delivery Fee:</span>
                      <span className="font-mono font-medium">₱{Number(orderDetails.deliveryFee).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(orderDetails.discount || 0) > 0 && (
                    <div className="flex justify-between text-rose-600 font-medium">
                      <span>Discount:</span>
                      <span className="font-mono">- ₱{Number(orderDetails.discount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-700 font-semibold border-t border-stone-100 pt-1">
                    <span>Downpayment Logged:</span>
                    <span className="font-mono">- ₱{Number(orderDetails.downpayment || 0).toLocaleString()}</span>
                  </div>
                  {hasPhysicalStaffCustody && (
                    <div className="flex justify-between text-amber-800 font-bold bg-amber-50 p-1.5 rounded">
                      <span>Held in Staff Drawer ({orderDetails.heldPaymentMethod || "Cash"}):</span>
                      <span className="font-mono">
                        ₱{heldByStaffAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {Number(orderDetails.digitalTransferAmount || 0) > 0 &&
                    orderDetails.settlementCustodyStatus !== "Settled" && (
                    <div className="space-y-1 rounded-lg border border-sky-300 bg-sky-50 p-2 text-sky-950">
                      <div className="flex justify-between font-bold gap-3">
                        <span>🏦 Awaiting Owner Digital Check ({orderDetails.digitalTransferMethod || orderDetails.heldPaymentMethod || "Digital"}):</span>
                        <span className="font-mono shrink-0">
                          ₱{Number(orderDetails.digitalTransferAmount).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono break-words">
                        Bank / Reference Note: {orderDetails.digitalReferenceNote || "Not recorded"}
                      </p>
                    </div>
                  )}
                  {orderDetails.settlementCustodyStatus === "AwaitingOwnerDigitalVerification" &&
                    Number(orderDetails.deliveryFee || 0) > 0 && (
                    <div className="rounded-lg border-2 border-amber-400 bg-amber-100 p-2.5 text-xs font-black text-amber-950">
                      💸 Rider Fee Payout: Owner to send ₱{Number(orderDetails.deliveryFee).toLocaleString()} to {orderDetails.assignedRiderName || "the assigned rider"} via GCash (Customer paid full balance digitally)
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-stone-900 border-t border-stone-200 pt-1.5">
                    <span>Customer Balance Due:</span>
                    <span className={`font-mono ${Number(orderDetails.balanceDue || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      ₱{Number(orderDetails.balanceDue || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment History Logs */}
                {orderDetails.paymentLogs?.length > 0 && (
                  <div className="pt-3 border-t border-stone-200 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Payment History Logs</p>
                    <div className="space-y-1.5">
                      {orderDetails.paymentLogs.map((p: any) => (
                        <div key={p.id} className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          p.isVoided ? "bg-rose-50 border-rose-200 opacity-60 line-through" : "bg-stone-50 border-stone-200"
                        }`}>
                          <div>
                            <span className="font-bold text-stone-900">{p.paymentMethod}</span>
                            <span className="font-mono font-semibold text-emerald-800 ml-1.5">
                              ₱{Number(p.amount || 0).toLocaleString()}
                            </span>
                            {p.referenceNumber && (
                              <span className="text-stone-500 text-[11px] block">Ref: {p.referenceNumber}</span>
                            )}
                            <span className="text-stone-400 text-[10px] block">
                              {new Date(p.createdAt).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}{p.recordedBy ? ` • by @${String(p.recordedBy).replace(/^@/, "")}` : ""}
                            </span>
                          </div>
                          <div>
                            {p.isVoided ? (
                              <Badge className="bg-rose-100 text-rose-800 text-[10px]">Voided</Badge>
                            ) : isOwner ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] text-rose-600 hover:bg-rose-50 font-semibold"
                                onClick={() => setPaymentToVoid(p)}
                              >
                                Void
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 4: AUDIT TRAIL */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200/90 shadow-2xs space-y-2">
                <h3 className="font-bold text-sm border-b border-stone-200 pb-2 text-stone-700 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-stone-500" />
                  <span>Audit History</span>
                </h3>
                {isAuditLoading ? (
                  <p className="text-stone-400 text-xs">Loading audit trail...</p>
                ) : auditLogs?.length ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {auditLogs.map((log: any) => (
                      <div key={log.id} className="text-xs border-b border-stone-100 pb-1">
                        <span className="font-semibold text-stone-900">{log.actionType}</span>
                        <span className="text-stone-500 text-[11px] ml-1.5">by {log.changedBy || "system"}</span>
                        <p className="text-stone-600 text-[11px] font-mono mt-0.5">
                          {log.changeDescription || log.changes || log.details || log.actionType}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 text-xs">No modification history recorded.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-rose-600 font-semibold text-sm">
              Failed to load order #{orderId}.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* LOG PAYMENT DIALOG */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-stone-300 rounded-2xl shadow-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-700" />
              <span>Log Payment for #{orderDetails?.orderReference || orderId}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handlePaymentSubmit} className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">Customer: {orderDetails?.customerName}</span>
              <span className="font-bold text-rose-700 font-mono">
                Balance: ₱{Number(orderDetails?.balanceDue || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-y border-stone-100">
              <span className="text-xs font-semibold text-stone-700">Split into 2 payment channels?</span>
              <input
                type="checkbox"
                checked={isSplitPayment}
                onChange={(e) => setIsSplitPayment(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-emerald-600 cursor-pointer"
              />
            </div>

            {/* Payment Leg 1 */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-stone-700">
                {isSplitPayment ? "Payment Leg 1" : "Payment Amount & Channel"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={paymentMethod} onValueChange={(val) => { if (val) setPaymentMethod(val); }}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GCash">📱 GCash</SelectItem>
                    <SelectItem value="Cash">💵 Cash</SelectItem>
                    <SelectItem value="Maya">💚 Maya</SelectItem>
                    <SelectItem value="Bank Transfer">🏦 Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Amount (₱)"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-8 text-xs font-mono font-bold"
                  required
                />
              </div>
              <Input
                type="text"
                placeholder="Reference Number (optional)"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Payment Leg 2 (if split) */}
            {isSplitPayment && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <Label className="text-xs font-semibold text-stone-700">Payment Leg 2</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={paymentMethod2} onValueChange={(val) => { if (val) setPaymentMethod2(val); }}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">💵 Cash</SelectItem>
                      <SelectItem value="GCash">📱 GCash</SelectItem>
                      <SelectItem value="Maya">💚 Maya</SelectItem>
                      <SelectItem value="Bank Transfer">🏦 Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Amount (₱)"
                    value={paymentAmount2}
                    onChange={(e) => setPaymentAmount2(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-8 text-xs font-mono font-bold"
                    required
                  />
                </div>
                <Input
                  type="text"
                  placeholder="Reference Number (optional)"
                  value={referenceNumber2}
                  onChange={(e) => setReferenceNumber2(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPaymentOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={paymentMutation.isPending}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {paymentMutation.isPending ? "Recording..." : "Save Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VOID PAYMENT CONFIRMATION DIALOG */}
      {paymentToVoid && (
        <Dialog open={Boolean(paymentToVoid)} onOpenChange={(open) => { if (!open) setPaymentToVoid(null); }}>
          <DialogContent className="sm:max-w-md bg-white border border-stone-300 rounded-2xl shadow-xl p-5">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>Void Payment # {paymentToVoid.id}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs pt-1">
              <p className="text-stone-600">
                Are you sure you want to void the <strong>₱{Number(paymentToVoid.amount).toLocaleString()}</strong> ({paymentToVoid.paymentMethod}) payment?
                This will restore the customer&apos;s unpaid balance.
              </p>

              <div>
                <Label className="text-xs font-semibold text-stone-700">Reason for Voiding</Label>
                <Input
                  type="text"
                  placeholder="e.g. Mistyped amount, Customer paid wrong account"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="h-8 text-xs mt-1"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaymentToVoid(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={voidPaymentMutation.isPending}
                onClick={handleVoidPaymentSubmit}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {voidPaymentMutation.isPending ? "Voiding..." : "Confirm Void"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
