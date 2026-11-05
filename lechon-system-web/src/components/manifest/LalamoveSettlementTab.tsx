/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  usePendingLalamoveQuery,
  useReleaseLalamoveMutation,
  PendingLalamoveSettlement,
} from "@/hooks/useManifest";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SettlePickupModal } from "./SettlePickupModal";
import { WalkInBadge } from "@/components/WalkInBadge";
import { isWalkInOrder } from "@/utils/walkIn";
import { Package, Eye, CheckCircle2, AlertCircle, Search } from "lucide-react";

export interface LalamoveSettlementTabProps {
  searchQuery?: string;
  onClearSearch?: () => void;
  onSelectOrder?: (orderId: number) => void;
}

export function LalamoveSettlementTab({
  searchQuery = "",
  onClearSearch,
  onSelectOrder,
}: LalamoveSettlementTabProps = {}) {
  const navigate = useNavigate();
  const { data: lalamoveOrders = [], isLoading } = usePendingLalamoveQuery();
  const [selectedOrderForPayment, setSelectedOrderForPayment] =
    useState<PendingLalamoveSettlement | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [releasingOrderId, setReleasingOrderId] = useState<number | null>(null);

  const releaseMutation = useReleaseLalamoveMutation();

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return lalamoveOrders;
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.startsWith("#") ? q.slice(1) : q;
    return lalamoveOrders.filter((order) => {
      const orderIdStr = String(order.id ?? order.orderId ?? "");
      const customer = (order.customerName || "").toLowerCase();
      const phone = (order.contactNumber || "").toLowerCase();
      const address = (order.deliveryAddress || "").toLowerCase();

      return (
        orderIdStr.includes(cleanQ) ||
        customer.includes(q) ||
        phone.includes(q) ||
        address.includes(q)
      );
    });
  }, [lalamoveOrders, searchQuery]);

  const handleOpenPayment = (order: PendingLalamoveSettlement) => {
    setSelectedOrderForPayment(order);
    setIsPaymentModalOpen(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedOrderForPayment(null);
  };

  const handleReleaseCourier = (orderId: number) => {
    setReleasingOrderId(orderId);
    releaseMutation.mutate(orderId, {
      onSuccess: () => {
        toast.success(`Order #${orderId} successfully released to courier!`);
        setReleasingOrderId(null);
      },
      onError: (err: any) => {
        const errorMsg =
          err?.response?.data?.message ||
          "Failed to confirm courier release. Please try again.";
        toast.error("Release Failed", {
          description: errorMsg,
        });
        setReleasingOrderId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading pending Lalamove courier handovers...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-white border border-stone-200/90 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-stone-50/70 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 text-orange-900 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                  Lalamove Courier Pre-Release Gate ({filteredOrders.length})
                </h3>
                {searchQuery.trim() && (
                  <Badge variant="outline" className="text-[11px] font-normal text-stone-600 bg-white">
                    Showing {filteredOrders.length} of {lalamoveOrders.length} orders
                  </Badge>
                )}
              </div>
              <p className="text-xs text-stone-500">
                Anti-Loss Security Gate: App couriers transport goods but do not collect payments. Release only when 100% paid.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/80 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="px-3.5 py-2.5">Order # &amp; Customer</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Date &amp; Time</th>
                <th className="px-3 py-2.5">Drop-off Destination</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-l border-stone-200">Balance Due</th>
                <th className="px-3 py-2.5 text-center whitespace-nowrap border-l border-stone-200">Gate Status</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-10 text-center text-stone-500"
                  >
                    {lalamoveOrders.length === 0 ? (
                      "🎉 No Lalamove orders pending courier release."
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="w-6 h-6 text-stone-400" />
                        <p className="text-sm font-medium text-stone-700">
                          No orders matching &quot;{searchQuery}&quot;
                        </p>
                        {onClearSearch && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onClearSearch}
                            className="mt-1 h-7 text-xs cursor-pointer border-stone-300"
                          >
                            Clear Search
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: PendingLalamoveSettlement) => {
                  const targetDate = new Date(order.targetDeliveryTime);
                  const formattedDate = targetDate.toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const formattedTime = targetDate.toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });

                  const isCleared = order.isClearedForRelease || order.balanceDue <= 0;
                  const isReleasing = releasingOrderId === order.orderId;
                  const isWalkIn = isWalkInOrder(order);

                  return (
                    <tr
                      key={order.orderId}
                      className={`${isWalkIn ? "bg-indigo-50/40" : ""} hover:bg-amber-50/30 transition-colors`}
                    >
                      {/* Order # & Customer */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-0.5 max-w-[180px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onSelectOrder?.(order.id ?? order.orderId)}
                              className="font-mono text-xs font-bold text-stone-700 hover:text-orange-800 hover:underline cursor-pointer transition-colors text-left"
                              title="Open Order Dossier"
                            >
                              #{order.orderId}
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectOrder?.(order.id ?? order.orderId)}
                              className="text-left font-semibold text-stone-900 text-xs leading-snug break-words line-clamp-1 hover:text-orange-800 hover:underline cursor-pointer transition-colors"
                              title={`Open Dossier for ${order.customerName}`}
                            >
                              {order.customerName}
                            </button>
                            {order.isTrustedCustomer && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold shrink-0"
                              >
                                👑 VIP
                              </Badge>
                            )}
                            <WalkInBadge
                              source={order.source}
                              customerName={order.customerName}
                              facebookName={order.facebookName}
                            />
                          </div>
                          {order.contactNumber && (
                            <div className="text-xs font-mono text-stone-500 truncate">
                              {order.contactNumber}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date / Schedule */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-stone-700">
                        <div className="font-semibold text-xs text-stone-800 leading-tight">{formattedDate}</div>
                        <div className="font-mono text-[11px] text-stone-500 leading-tight">{formattedTime}</div>
                      </td>

                      {/* Drop-off Destination */}
                      <td className="px-3 py-2.5 text-stone-700 text-xs">
                        <div
                          className="whitespace-normal break-words max-w-[200px] line-clamp-2 leading-tight"
                          title={order.deliveryAddress || "Customer booked pin"}
                        >
                          {order.deliveryAddress || "Customer booked pin"}
                        </div>
                      </td>

                      {/* Balance Due */}
                      <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap text-xs tabular-nums border-l border-stone-200">
                        {order.balanceDue > 0 ? (
                          <span className="text-rose-600 font-bold">
                            ₱{order.balanceDue.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">₱0.00</span>
                        )}
                      </td>

                      {/* Gate Status Badge */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs border-l border-stone-200">
                        {isCleared ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-semibold text-xs py-0.5 px-2 shadow-2xs">
                            🟢 CLEAR TO RELEASE
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-300 font-semibold text-xs py-0.5 px-2 shadow-2xs"
                          >
                            🛑 UNPAID BALANCE
                          </Badge>
                        )}
                      </td>

                      {/* Action Button (UNIFORM ALIGNED COLUMNS) */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap text-xs">
                        <div className="w-[240px] flex items-center justify-end gap-1.5 ml-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-[98px] border-stone-300 text-stone-700 hover:bg-stone-100 text-xs px-2 h-8 whitespace-nowrap font-medium rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                            onClick={() => {
                              if (onSelectOrder) {
                                onSelectOrder(order.id ?? order.orderId);
                              } else {
                                navigate(`/orders?openOrderId=${order.id ?? order.orderId}`);
                              }
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                            <span>View Order</span>
                          </Button>
                          {isCleared ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  className="w-[136px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs text-xs px-2.5 h-8 whitespace-nowrap rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                                  size="sm"
                                  disabled={isReleasing}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>{isReleasing ? "Releasing..." : "Release to Courier"}</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirm Courier Release</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to hand over <strong>Order #{order.id ?? order.orderId} ({order.customerName})</strong> to the courier?
                                    <br /><br />
                                    Please ensure the lechon has been packed, the parcel is sealed, and the driver&apos;s app booking matches this order.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                    onClick={() => handleReleaseCourier(order.id ?? order.orderId)}
                                    disabled={isReleasing}
                                  >
                                    {isReleasing ? "Releasing..." : "Confirm & Release"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-[136px] border-rose-300 bg-rose-50/60 text-rose-700 hover:bg-rose-100 text-xs px-2.5 h-8 whitespace-nowrap font-semibold rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                              onClick={() => handleOpenPayment(order)}
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Verify Payment</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment / Counter Settlement Modal */}
      {selectedOrderForPayment && (
        <SettlePickupModal
          open={isPaymentModalOpen}
          onOpenChange={(open) => {
            if (!open) handleClosePaymentModal();
          }}
          order={{
            orderId: selectedOrderForPayment.orderId,
            customerName: selectedOrderForPayment.customerName,
            balanceDue: selectedOrderForPayment.balanceDue,
            deliveryFee: 0,
            targetDeliveryTime: selectedOrderForPayment.targetDeliveryTime,
            isTrustedCustomer: selectedOrderForPayment.isTrustedCustomer,
          }}
          onSuccess={handleClosePaymentModal}
        />
      )}
    </div>
  );
}

export { LalamoveSettlementTab as LalamoveGateTab };
