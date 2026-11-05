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
import { Store, RotateCcw, HandCoins, Search } from "lucide-react";

export interface PickupSettlementTabProps {
  selectedCustodian?: string | null;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSelectOrder?: (orderId: number) => void;
}

export function PickupSettlementTab({
  selectedCustodian,
  searchQuery = "",
  onClearSearch,
  onSelectOrder,
}: PickupSettlementTabProps = {}) {
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

  const filteredPickups = useMemo(() => {
    if (!searchQuery.trim()) return visiblePickups;
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.startsWith("#") ? q.slice(1) : q;
    return visiblePickups.filter((p) => {
      const orderIdStr = String(p.orderId || "");
      const customer = (p.customerName || "").toLowerCase();
      const phone = (p.contactNumber || "").toLowerCase();
      const address = (p.address || "").toLowerCase();
      const landmark = (p.landmark || "").toLowerCase();
      const remarks = (p.remarks || "").toLowerCase();

      return (
        orderIdStr.includes(cleanQ) ||
        customer.includes(q) ||
        phone.includes(q) ||
        address.includes(q) ||
        landmark.includes(q) ||
        remarks.includes(q)
      );
    });
  }, [visiblePickups, searchQuery]);

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
      <Card className="bg-white border border-stone-200/90 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-stone-50/70 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                  Walk-in Store Pickup Handovers ({filteredPickups.length})
                </h3>
                {searchQuery.trim() && (
                  <Badge variant="outline" className="text-[11px] font-normal text-stone-600 bg-white">
                    Showing {filteredPickups.length} of {visiblePickups.length} pickups
                  </Badge>
                )}
              </div>
              <p className="text-xs text-stone-500">
                The &quot;Notebook Rule&quot;: Unsettled store pickups remain visible indefinitely until drawer cash is reconciled with the Business Owner.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/80 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="px-3.5 py-2.5">Customer</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Date &amp; Time</th>
                <th className="px-3 py-2.5">Address / Landmark</th>
                <th className="px-3 py-2.5">Custody Status</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Grand Total</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-l border-stone-200">Downpayment</th>
                <th className="px-3 py-2.5 text-right text-emerald-700 bg-emerald-50/50 whitespace-nowrap border-l border-stone-200 font-bold">
                  Balance to Collect
                </th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {filteredPickups.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-10 text-center text-stone-500"
                  >
                    {visiblePickups.length === 0 ? (
                      "🎉 No store pickup balances pending settlement."
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="w-6 h-6 text-stone-400" />
                        <p className="text-sm font-medium text-stone-700">
                          No pickups matching &quot;{searchQuery}&quot;
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
                filteredPickups.map((pickup: PendingPickupSettlement) => {
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
                      className={`hover:bg-amber-50/30 transition-colors ${
                        isWalkIn
                          ? "bg-indigo-50/40"
                          : isInDrawer
                            ? "bg-amber-50/20"
                            : ""
                      }`}
                    >
                      {/* Customer Column */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-0.5 max-w-[170px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onSelectOrder?.(pickup.orderId)}
                              className="font-mono text-xs font-bold text-stone-700 hover:text-emerald-800 hover:underline cursor-pointer transition-colors"
                              title="Open Order Dossier"
                            >
                              #{pickup.orderId}
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectOrder?.(pickup.orderId)}
                              className="text-left font-semibold text-stone-900 text-xs leading-snug break-words line-clamp-1 hover:text-emerald-800 hover:underline cursor-pointer transition-colors"
                              title={`Open Dossier for ${pickup.customerName}`}
                            >
                              {pickup.customerName}
                            </button>
                            {pickup.isTrustedCustomer && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold shrink-0"
                              >
                                👑 VIP
                              </Badge>
                            )}
                            <WalkInBadge
                              source={pickup.source}
                              customerName={pickup.customerName}
                              facebookName={pickup.facebookName}
                            />
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

                      {/* Custody Status Badge */}
                      <td className="px-3 py-2.5 text-xs">
                        {isInDrawer ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                              In Drawer
                            </span>
                            <span
                              className="text-[11px] font-medium text-stone-500 pl-1 block truncate max-w-[130px]"
                              title={`Held by ${pickup.heldByStaffName || "Cashier"}`}
                            >
                              Held by {pickup.heldByStaffName || "Cashier"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-stone-600 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                            Uncollected
                          </span>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td className="px-3 py-2.5 text-right font-mono text-stone-800 text-xs tabular-nums whitespace-nowrap font-medium">
                        ₱{pickup.grandTotal.toLocaleString()}
                      </td>

                      {/* Downpayment */}
                      <td className="px-3 py-2.5 text-right font-mono text-stone-600 text-xs tabular-nums whitespace-nowrap border-l border-stone-200">
                        ₱{pickup.downpayment.toLocaleString()}
                      </td>

                      {/* Balance to Collect */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40 text-xs tabular-nums whitespace-nowrap border-l border-stone-200">
                        ₱{Number(pickup.heldByStaffAmount ?? pickup.balanceDue).toLocaleString()}
                      </td>

                      {/* REFINED, COHESIVE ACTIONS COLUMN (UNIFORM ALIGNED WIDTH) */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap text-xs">
                        <div className="w-[152px] flex items-center justify-end gap-1.5 ml-auto">
                          {isInDrawer ? (
                            <>
                              <Button
                                size="sm"
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-2xs h-8 px-2.5 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                onClick={() => handleOpenOwnerRemit(pickup)}
                              >
                                <HandCoins className="w-3.5 h-3.5 shrink-0" />
                                <span>Remit</span>
                              </Button>
                              {(isOwner ||
                                (Boolean(user?.username) &&
                                  Boolean(pickup.heldByStaffName) &&
                                  user!.username.toLowerCase() ===
                                    pickup.heldByStaffName!.toLowerCase())) && (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border-stone-200 rounded-lg cursor-pointer shrink-0"
                                  title="Revert Custody to Uncollected"
                                  disabled={revertCustodyMutation.isPending}
                                  onClick={() => handleRevertCustody(pickup.orderId)}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs h-8 px-2.5 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              onClick={() => handleOpenCounterCollect(pickup)}
                            >
                              <Store className="w-3.5 h-3.5 shrink-0" />
                              <span>Collect at Counter</span>
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

      {/* Settle Pickup Modal */}
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

      {/* Hop 2 QR Remit to Owner Modal */}
      {selectedOwnerRemit && (
        <QrSettlementModal
          open={Boolean(selectedOwnerRemit)}
          onOpenChange={(open) => {
            if (!open) handleCloseOwnerRemit();
          }}
          orderId={selectedOwnerRemit.orderId}
          customerName={selectedOwnerRemit.customerName}
          expectedAmount={
            selectedOwnerRemit.heldByStaffAmount ??
            selectedOwnerRemit.balanceDue
          }
          hopStage="StaffToOwner"
          heldByStaffName={selectedOwnerRemit.heldByStaffName}
          heldPaymentMethod={selectedOwnerRemit.heldPaymentMethod}
          onSuccess={() => {
            handleCloseOwnerRemit();
          }}
        />
      )}
    </div>
  );
}
