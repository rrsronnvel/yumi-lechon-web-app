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
      <Card className="bg-white border border-stone-200/90 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-stone-900">
              Walk-in Store Pickup Handovers ({pickups.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              The &quot;Notebook Rule&quot;: Unsettled store pickups remain visible indefinitely until drawer cash is reconciled with the Business Owner.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                <th className="px-3 py-3">Customer</th>

                <th className="px-3 py-3">Pickup Time</th>
                <th className="px-3 py-3">Address / Landmark</th>
                <th className="px-3 py-3">Custody Status</th>
                <th className="px-3 py-3 text-right">Grand Total</th>
                <th className="px-3 py-3 text-right">Downpayment</th>
                <th className="px-3 py-3 text-right text-emerald-700 bg-emerald-50/30">
                  Balance to Collect
                </th>
                <th className="px-3 py-3 text-center w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {pickups.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-10 text-center text-stone-500"
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
                      className={`hover:bg-stone-50/70 transition-colors ${
                        isInDrawer ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Customer Column */}
                      <td className="px-3 py-2.5 min-w-[150px] max-w-[220px]">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-stone-500">
                              #{pickup.orderId}
                            </span>
                            <span
                              className="font-medium text-stone-900 text-xs sm:text-sm leading-snug break-words"
                              title={pickup.customerName}
                            >
                              {pickup.customerName}
                            </span>
                            {pickup.isTrustedCustomer && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold shrink-0"
                              >
                                👑 VIP
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-stone-500 font-mono">
                            {pickup.contactNumber || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Pickup Time */}
                      <td className="px-3 py-3 text-stone-700 whitespace-nowrap text-xs">
                        {formattedPickupTime}
                      </td>

                      {/* Address / Landmark */}
                      <td className="px-3 py-3 max-w-[220px] break-words text-xs">
                        <div className="text-stone-700 font-medium">
                          {pickup.address || "Store Counter"}
                        </div>
                        {pickup.landmark && (
                          <div className="text-stone-400 text-[11px] italic mt-0.5">
                            📍 {pickup.landmark}
                          </div>
                        )}
                        {!pickup.address && pickup.remarks && (
                          <div className="text-stone-400 text-[11px] italic mt-0.5">
                            {pickup.remarks}
                          </div>
                        )}
                      </td>

                      {/* Custody Status Badge */}
                      <td className="px-3 py-3 whitespace-nowrap">
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
                            className="bg-stone-50 text-stone-600 border-stone-300 text-xs py-1 px-2 flex items-center gap-1.5 w-fit"
                          >
                            <span className="w-2 h-2 rounded-full bg-stone-400" />
                            <span>⚪ Uncollected</span>
                          </Badge>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td className="px-3 py-3 text-right font-mono text-stone-700">
                        ₱{pickup.grandTotal.toLocaleString()}
                      </td>

                      {/* Downpayment */}
                      <td className="px-3 py-3 text-right font-mono text-stone-500">
                        ₱{pickup.downpayment.toLocaleString()}
                      </td>

                      {/* Balance to Collect */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20 whitespace-nowrap">
                        ₱{pickup.balanceDue.toLocaleString()}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 w-[140px] text-center whitespace-nowrap">
                        {isInDrawer ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-xs"
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
                                className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 text-xs px-2 h-8"
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
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs"
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
