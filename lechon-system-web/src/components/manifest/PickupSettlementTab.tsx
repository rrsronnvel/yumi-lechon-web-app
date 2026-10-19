import { useState } from "react";
import {
  usePendingPickupsQuery,
  useRevertCustodyMutation,
  PendingPickupSettlement,
} from "@/hooks/useManifest";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettlePickupModal } from "./SettlePickupModal";
import { QrSettlementModal } from "./QrSettlementModal";
import { toast } from "sonner";

export function PickupSettlementTab() {
  const { user, isOwner } = useAuth();
  const { data: pickups = [], isLoading } = usePendingPickupsQuery();
  const revertCustodyMutation = useRevertCustodyMutation();

  const handleRevertCustody = (orderId: number) => {
    revertCustodyMutation.mutate(orderId, {
      onSuccess: () => {
        toast.success(`Order #${orderId} custody reverted to Uncollected!`);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to revert custody.");
      },
    });
  };

  // Tab 2 Counter Collect modal state (Uncollected -> InStaffDrawer)
  const [selectedPickup, setSelectedPickup] =
    useState<PendingPickupSettlement | null>(null);
  const [isCounterCollectOpen, setIsCounterCollectOpen] =
    useState<boolean>(false);

  // Tab 2 Remit to Owner QR modal state (InStaffDrawer -> Settled)
  const [selectedOwnerRemit, setSelectedOwnerRemit] =
    useState<PendingPickupSettlement | null>(null);

  const handleOpenCounterCollect = (pickup: PendingPickupSettlement) => {
    setSelectedPickup(pickup);
    setIsCounterCollectOpen(true);
  };

  const handleCloseCounterCollect = () => {
    setIsCounterCollectOpen(false);
    setSelectedPickup(null);
  };

  const handleOpenOwnerRemit = (pickup: PendingPickupSettlement) => {
    setSelectedOwnerRemit(pickup);
  };

  const handleCloseOwnerRemit = () => {
    setSelectedOwnerRemit(null);
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
              The &quot;Notebook Rule&quot;: Unsettled store pickups remain visible indefinitely until drawer cash is reconciled with the Business Owner.
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
                <th className="p-4">Custody Status</th>
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
                    colSpan={9}
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

                  const isInDrawer = pickup.custodyStatus === "InStaffDrawer";

                  return (
                    <tr
                      key={pickup.orderId}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isInDrawer ? "bg-amber-50/20" : ""
                      }`}
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

                      {/* Custody Status Badge */}
                      <td className="p-4 whitespace-nowrap">
                        {isInDrawer ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold py-1 px-2.5 flex items-center gap-1.5 w-fit shadow-xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>
                              🟡 In Staff Drawer: Held by {pickup.heldByStaffName || "Cashier"}
                            </span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-slate-600 border-slate-300 text-xs py-1 px-2 flex items-center gap-1.5 w-fit"
                          >
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>⚪ Uncollected</span>
                          </Badge>
                        )}
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
                        {isInDrawer ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-sm"
                              onClick={() => handleOpenOwnerRemit(pickup)}
                            >
                              👑 Remit to Owner
                            </Button>
                            {(isOwner ||
                              (Boolean(user?.username) &&
                                Boolean(pickup.heldByStaffName) &&
                                user!.username.toLowerCase() ===
                                  pickup.heldByStaffName!.toLowerCase())) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs px-2 h-8"
                                title="Revert Custody to Uncollected"
                                disabled={revertCustodyMutation.isPending}
                                onClick={() => handleRevertCustody(pickup.orderId)}
                              >
                                ↩️
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                            onClick={() => handleOpenCounterCollect(pickup)}
                          >
                            Collect at Counter
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

      {/* Counter Collection Modal (Step 1 for Store Pickups: Uncollected -> InStaffDrawer) */}
      {selectedPickup && (
        <SettlePickupModal
          open={isCounterCollectOpen}
          onOpenChange={(open) => {
            if (!open) handleCloseCounterCollect();
          }}
          order={{
            orderId: selectedPickup.orderId,
            customerName: selectedPickup.customerName,
            targetDeliveryTime: selectedPickup.targetDeliveryTime,
            balanceDue: selectedPickup.balanceDue,
            deliveryFee: 0,
            isTrustedCustomer: selectedPickup.isTrustedCustomer,
          }}
          onSuccess={handleCloseCounterCollect}
        />
      )}

      {/* Hop 2 QR Settlement Modal for Pickups (InStaffDrawer -> Settled by Owner) */}
      {selectedOwnerRemit && (
        <QrSettlementModal
          open={Boolean(selectedOwnerRemit)}
          onOpenChange={(open) => {
            if (!open) handleCloseOwnerRemit();
          }}
          orderId={selectedOwnerRemit.orderId}
          customerName={selectedOwnerRemit.customerName}
          expectedAmount={selectedOwnerRemit.balanceDue}
          riderName="Walk-in Store Pickup"
          hopStage="StaffToOwner"
          heldByStaffName={selectedOwnerRemit.heldByStaffName}
          heldPaymentMethod={selectedOwnerRemit.heldPaymentMethod}
          riderSignedBy="Walk-in Customer"
          onSuccess={handleCloseOwnerRemit}
        />
      )}
    </div>
  );
}
