import { useState, useMemo } from "react";
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
import { WalkInBadge } from "@/components/WalkInBadge";
import { isWalkInOrder } from "@/utils/walkIn";

export function PickupSettlementTab({ selectedCustodian }: { selectedCustodian?: string | null } = {}) {
  const { user, isOwner } = useAuth();
  const { data: pickups = [], isLoading } = usePendingPickupsQuery();
  const visiblePickups = useMemo(() => {
    if (!selectedCustodian) return pickups;
    return pickups.filter((p) => {
      const isDrawer = (p.settlementCustodyStatus || p.custodyStatus) === "InStaffDrawer";
      const custodian = p.heldByStaffName?.trim() || "Staff";
      return isDrawer && custodian === selectedCustodian;
    });
  }, [pickups, selectedCustodian]);

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

        <div className="overflow-x-auto xl:overflow-x-hidden w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5">Address / Landmark</th>
                <th className="px-3 py-2.5">Custody Status</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Grand Total</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-l border-stone-200/80">Downpayment</th>
                <th className="px-3 py-2.5 text-right text-emerald-700 bg-emerald-50/40 whitespace-nowrap border-l border-stone-200/80">
                  Balance to Collect
                </th>
                <th className="px-3 py-2.5 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {visiblePickups.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-10 text-center text-stone-500"
                  >
                    🎉 No store pickup balances pending settlement.
                  </td>
                </tr>
              ) : (
                visiblePickups.map((pickup: PendingPickupSettlement) => {
                  const pickupDate = new Date(pickup.targetDeliveryTime);
                  const formattedPickupDate = pickupDate.toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const formattedPickupTime = pickupDate.toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });

                  const isInDrawer = pickup.custodyStatus === "InStaffDrawer";
                  const isWalkIn = isWalkInOrder(pickup);

                  return (
                    <tr
                      key={pickup.orderId}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        isWalkIn
                          ? "bg-indigo-50/40"
                          : isInDrawer
                            ? "bg-amber-50/20"
                            : ""
                      }`}
                    >
                      {/* Customer Column */}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5 max-w-[170px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-stone-500">
                              #{pickup.orderId}
                            </span>
                            <span
                              className="font-medium text-stone-900 text-xs leading-snug break-words line-clamp-1"
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
                            <WalkInBadge {...pickup} />
                          </div>
                          <span className="text-xs text-stone-500 font-mono">
                            {pickup.contactNumber || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Pickup Time */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-stone-700">
                        <div className="font-semibold text-xs text-stone-800 leading-tight">{formattedPickupDate}</div>
                        <div className="font-mono text-[11px] text-stone-500 leading-tight">{formattedPickupTime}</div>
                      </td>

                      {/* Address / Landmark */}
                      <td className="px-3 py-2.5 text-xs">
                        <div className="whitespace-normal break-words max-w-[180px] lg:max-w-[200px] line-clamp-2 leading-tight">
                          <span className="text-stone-700 font-medium">
                            {pickup.address || "Store Counter"}
                          </span>
                          {pickup.landmark && (
                            <span className="text-stone-400 text-[11px] italic block">
                              📍 {pickup.landmark}
                            </span>
                          )}
                          {!pickup.address && pickup.remarks && (
                            <span className="text-stone-400 text-[11px] italic block">
                              {pickup.remarks}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Custody Status Badge - Stacked */}
                      <td className="px-3 py-2.5 text-xs">
                        {isInDrawer ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                              🟡 In Drawer
                            </span>
                            <span
                              className="text-[11px] font-medium text-stone-600 pl-1 block truncate max-w-[140px]"
                              title={`Held by ${pickup.heldByStaffName || "Cashier"}`}
                            >
                              Held by {pickup.heldByStaffName || "Cashier"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-stone-600 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                            ⚪ Uncollected
                          </span>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td className="px-3 py-2.5 text-right font-mono text-stone-800 text-xs tabular-nums whitespace-nowrap font-medium">
                        ₱{pickup.grandTotal.toLocaleString()}
                      </td>

                      {/* Downpayment */}
                      <td className="px-3 py-2.5 text-right font-mono text-stone-600 text-xs tabular-nums whitespace-nowrap border-l border-stone-200/80">
                        ₱{pickup.downpayment.toLocaleString()}
                      </td>

                      {/* Balance to Collect */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20 text-xs tabular-nums whitespace-nowrap border-l border-stone-200/80">
                        ₱{pickup.balanceDue.toLocaleString()}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs">
                        {isInDrawer ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-xs h-8 px-2.5"
                              onClick={() => handleOpenOwnerRemit(pickup)}
                            >
                              👑 Remit
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
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs h-8 px-2.5"
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
