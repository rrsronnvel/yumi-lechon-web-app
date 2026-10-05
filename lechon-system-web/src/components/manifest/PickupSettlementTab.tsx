import { useState } from "react";
import {
  usePendingPickupsQuery,
  PendingPickupSettlement,
} from "@/hooks/useManifest";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettlePickupModal } from "./SettlePickupModal";

export function PickupSettlementTab() {
  const { data: pickups = [], isLoading } = usePendingPickupsQuery();
  const [selectedPickup, setSelectedPickup] =
    useState<PendingPickupSettlement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleOpenSettle = (pickup: PendingPickupSettlement) => {
    setSelectedPickup(pickup);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPickup(null);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading pending store pickup reconciliations...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-slate-800">
              Walk-in Store Pickup Handovers ({pickups.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              The "Notebook Rule": Unsettled store pickups remain visible indefinitely until drawer cash is reconciled.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                <th className="p-4">Customer</th>
                <th className="p-4">Contact Number</th>
                <th className="p-4">Pickup Time</th>
                <th className="p-4">Address / Landmark</th>
                <th className="p-4 text-right">Grand Total</th>
                <th className="p-4 text-right">Downpayment</th>
                <th className="p-4 text-right text-emerald-700 bg-emerald-50/30">
                  Balance to Collect
                </th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {pickups.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-10 text-center text-muted-foreground"
                  >
                    🎉 No store pickup balances pending settlement.
                  </td>
                </tr>
              ) : (
                pickups.map((pickup: PendingPickupSettlement) => {
                  const formattedPickupTime = new Date(
                    pickup.targetDeliveryTime
                  ).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });

                  return (
                    <tr
                      key={pickup.orderId}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Customer Column */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            #{pickup.orderId} • {pickup.customerName}
                          </span>
                          {pickup.isTrustedCustomer && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-semibold"
                            >
                              👑 VIP
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Contact Number */}
                      <td className="p-4 font-mono text-slate-600">
                        {pickup.contactNumber || "—"}
                      </td>

                      {/* Pickup Time */}
                      <td className="p-4 text-slate-700 whitespace-nowrap">
                        {formattedPickupTime}
                      </td>

                      {/* Address / Landmark */}
                      <td className="p-4 text-muted-foreground max-w-xs truncate">
                        {pickup.address || pickup.remarks || "Store Counter"}
                      </td>

                      {/* Grand Total */}
                      <td className="p-4 text-right font-mono text-slate-700">
                        ₱{pickup.grandTotal.toLocaleString()}
                      </td>

                      {/* Downpayment */}
                      <td className="p-4 text-right font-mono text-slate-500">
                        ₱{pickup.downpayment.toLocaleString()}
                      </td>

                      {/* Balance to Collect */}
                      <td className="p-4 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20 whitespace-nowrap">
                        ₱{pickup.balanceDue.toLocaleString()}
                      </td>

                      {/* Action */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                          onClick={() => handleOpenSettle(pickup)}
                        >
                          Collect & Settle
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Settle Pickup Modal */}
      {selectedPickup && (
        <SettlePickupModal
          open={isModalOpen}
          onOpenChange={(open) => {
            if (!open) handleCloseModal();
          }}
          order={{
            orderId: selectedPickup.orderId,
            customerName: selectedPickup.customerName,
            targetDeliveryTime: selectedPickup.targetDeliveryTime,
            balanceDue: selectedPickup.balanceDue,
            deliveryFee: 0,
            isTrustedCustomer: selectedPickup.isTrustedCustomer,
          }}
          onSuccess={handleCloseModal}
        />
      )}
    </div>
  );
}
