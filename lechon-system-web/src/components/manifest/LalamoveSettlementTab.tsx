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

  const handleRelease = (order: PendingLalamoveSettlement) => {
    if (!order.isClearedForRelease && order.balanceDue > 0) {
      toast.error("Cannot Release Order", {
        description: `Order #${order.orderId} has an unpaid balance of ₱${order.balanceDue.toLocaleString()}. Please verify and collect payment first.`,
      });
      return;
    }

    setReleasingOrderId(order.orderId);
    releaseMutation.mutate(order.orderId, {
      onSuccess: () => {
        toast.success(`Order #${order.orderId} Handover Confirmed!`, {
          description: `Dispatched to Lalamove courier for ${order.customerName}.`,
        });
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
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-800">
              Lalamove Pre-Release Gate ({lalamoveOrders.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Anti-Loss Security Gate: App couriers transport goods but do not collect payments. Release only when 100% paid.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <th className="p-4">Order # & Customer</th>
                <th className="p-4">Drop-off Destination</th>
                <th className="p-4">Target Time</th>
                <th className="p-4 text-right">Balance Due</th>
                <th className="p-4 text-center">Gate Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {lalamoveOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-10 text-center text-muted-foreground"
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
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Order # & Customer */}
                      <td className="p-4">
                        <div className="font-medium text-slate-900">
                          #{order.orderId} • {order.customerName}
                        </div>
                        {order.contactNumber && (
                          <div className="text-xs font-mono text-muted-foreground mt-0.5">
                            {order.contactNumber}
                          </div>
                        )}
                      </td>

                      {/* Drop-off Destination */}
                      <td className="p-4 text-slate-700 max-w-xs truncate">
                        {order.deliveryAddress || "Customer booked pin"}
                      </td>

                      {/* Target Time */}
                      <td className="p-4 text-slate-700 whitespace-nowrap">
                        {formattedTime}
                      </td>

                      {/* Balance Due */}
                      <td className="p-4 text-right font-mono font-semibold whitespace-nowrap">
                        {order.balanceDue > 0 ? (
                          <span className="text-red-600">
                            ₱{order.balanceDue.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-emerald-600">₱0.00</span>
                        )}
                      </td>

                      {/* Gate Status Badge */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {isCleared ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-semibold text-xs">
                            🟢 PAID IN FULL — CLEAR TO RELEASE
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="bg-red-100 text-red-800 hover:bg-red-100 border-red-300 font-semibold text-xs"
                          >
                            🛑 HOLD RELEASE: UNPAID BALANCE
                          </Badge>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {isCleared ? (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                            onClick={() => handleRelease(order)}
                            disabled={isReleasing}
                          >
                            {isReleasing
                              ? "Dispatching..."
                              : "Handover to Courier"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 text-xs font-medium"
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
