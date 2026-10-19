/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
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

export function LalamoveSettlementTab() {
  const { data: lalamoveOrders = [], isLoading } = usePendingLalamoveQuery();
  const [selectedOrderForPayment, setSelectedOrderForPayment] =
    useState<PendingLalamoveSettlement | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [releasingOrderId, setReleasingOrderId] = useState<number | null>(null);

  const releaseMutation = useReleaseLalamoveMutation();

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
      <Card className="bg-white border border-stone-200/90 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-stone-900">
              Lalamove Pre-Release Gate ({lalamoveOrders.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Anti-Loss Security Gate: App couriers transport goods but do not collect payments. Release only when 100% paid.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                <th className="px-3 py-3">Order # & Customer</th>
                <th className="px-3 py-3">Drop-off Destination</th>
                <th className="px-3 py-3">Target Time</th>
                <th className="px-3 py-3 text-right">Balance Due</th>
                <th className="px-3 py-3 text-center">Gate Status</th>
                <th className="px-3 py-3 text-center w-[140px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {lalamoveOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-10 text-center text-stone-500"
                  >
                    🎉 No Lalamove orders pending courier release.
                  </td>
                </tr>
              ) : (
                lalamoveOrders.map((order: PendingLalamoveSettlement) => {
                  const formattedTime = new Date(
                    order.targetDeliveryTime
                  ).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });

                  const isCleared = order.isClearedForRelease || order.balanceDue <= 0;
                  const isReleasing = releasingOrderId === order.orderId;

                  return (
                    <tr
                      key={order.orderId}
                      className="hover:bg-stone-50/70 transition-colors"
                    >
                      {/* Order # & Customer */}
                      <td className="px-3 py-2.5 min-w-[140px] max-w-[200px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-semibold text-stone-500">
                            #{order.orderId}
                          </span>
                          <span
                            className="font-medium text-stone-900 text-xs sm:text-sm leading-snug break-words"
                            title={order.customerName}
                          >
                            {order.customerName}
                          </span>
                          {order.contactNumber && (
                            <div className="text-xs font-mono text-stone-500 truncate">
                              {order.contactNumber}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Drop-off Destination */}
                      <td className="px-3 py-3 text-stone-700 max-w-[180px] lg:max-w-[220px] truncate" title={order.deliveryAddress || "Customer booked pin"}>
                        {order.deliveryAddress || "Customer booked pin"}
                      </td>

                      {/* Target Time */}
                      <td className="px-3 py-3 text-stone-700 whitespace-nowrap">
                        {formattedTime}
                      </td>

                      {/* Balance Due */}
                      <td className="px-3 py-3 text-right font-mono font-semibold whitespace-nowrap">
                        {order.balanceDue > 0 ? (
                          <span className="text-rose-600">
                            ₱{order.balanceDue.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-emerald-600">₱0.00</span>
                        )}
                      </td>

                      {/* Gate Status Badge */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {isCleared ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-semibold text-xs">
                            🟢 PAID IN FULL — CLEAR TO RELEASE
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-300 font-semibold text-xs"
                          >
                            🛑 HOLD RELEASE: UNPAID BALANCE
                          </Badge>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="px-3 py-3 text-center whitespace-nowrap w-[140px]">
                        {isCleared ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm text-xs cursor-pointer"
                                size="sm"
                                disabled={isReleasing}
                              >
                                {isReleasing ? "Releasing..." : "Release to Courier"}
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
                            className="border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-medium cursor-pointer"
                            onClick={() => handleOpenPayment(order)}
                          >
                            Verify Payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Settlement Modal for Unpaid Lalamove orders */}
      {selectedOrderForPayment && (
        <SettlePickupModal
          open={isPaymentModalOpen}
          onOpenChange={(open) => {
            if (!open) handleClosePaymentModal();
          }}
          order={{
            orderId: selectedOrderForPayment.orderId,
            customerName: selectedOrderForPayment.customerName,
            targetDeliveryTime: selectedOrderForPayment.targetDeliveryTime,
            balanceDue: selectedOrderForPayment.balanceDue,
            deliveryFee: 0,
          }}
          onSuccess={handleClosePaymentModal}
        />
      )}
    </div>
  );
}

// Re-export as LalamoveGateTab for seamless compatibility
export { LalamoveSettlementTab as LalamoveGateTab };
