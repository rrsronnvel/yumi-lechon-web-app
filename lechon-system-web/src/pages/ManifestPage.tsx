import { useState, useMemo } from "react";
import {
  usePendingSettlements,
  usePendingPickupsQuery,
  usePendingLalamoveQuery,
  useRevertCustodyMutation,
  computeCustodyMetrics,
  PendingSettlementDrop,
} from "@/hooks/useManifest";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PickupSettlementTab } from "@/components/manifest/PickupSettlementTab";
import { LalamoveSettlementTab } from "@/components/manifest/LalamoveSettlementTab";
import { QrSettlementModal } from "@/components/manifest/QrSettlementModal";
import { toast } from "sonner";
import { WalkInBadge } from "@/components/WalkInBadge";
import { isWalkInOrder } from "@/utils/walkIn";

const formatSchedule = (value?: string | null) => {
  if (!value) return { date: "—", time: "—" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "—", time: "—" };
  return {
    date: parsed.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

export default function ManifestPage() {
  const { user, isOwner } = useAuth();
  const { data: drops = [], isLoading: isLoadingRiders } = usePendingSettlements();
  const { data: pickupDrops = [] } = usePendingPickupsQuery();
  const { data: lalamoveDrops = [] } = usePendingLalamoveQuery();
  const revertCustodyMutation = useRevertCustodyMutation();

  const { inDrawerTotal, inDrawerCount, uncollectedTotal, uncollectedCount } =
    useMemo(() => {
      return computeCustodyMetrics(drops, pickupDrops);
    }, [drops, pickupDrops]);

  const [selectedCustodian, setSelectedCustodian] = useState<string | null>(null);

  const inDrawerItems = useMemo(() => {
    const riderInDrawer = drops
      .filter((d) => (d.settlementCustodyStatus || d.custodyStatus) === "InStaffDrawer")
      .map((d) => ({
        amount: Number(d.netRemittance || 0),
        custodian: d.heldByStaffName?.trim() || "Staff",
      }));

    const pickupInDrawer = pickupDrops
      .filter((p) => (p.settlementCustodyStatus || p.custodyStatus) === "InStaffDrawer")
      .map((p) => ({
        amount: Number(p.balanceDue || 0),
        custodian: p.heldByStaffName?.trim() || "Staff",
      }));

    return [...riderInDrawer, ...pickupInDrawer];
  }, [drops, pickupDrops]);

  const custodianBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    for (const item of inDrawerItems) {
      const existing = map.get(item.custodian) || { name: item.custodian, amount: 0, count: 0 };
      existing.amount += item.amount;
      existing.count += 1;
      map.set(item.custodian, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [inDrawerItems]);

  const visibleDrops = useMemo(() => {
    if (!selectedCustodian) return drops;
    return drops.filter((d) => {
      const isDrawer = (d.settlementCustodyStatus || d.custodyStatus) === "InStaffDrawer";
      const custodian = d.heldByStaffName?.trim() || "Staff";
      return isDrawer && custodian === selectedCustodian;
    });
  }, [drops, selectedCustodian]);

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

  // QR Modal State for Tab 1 & Tab 2
  const [qrModalData, setQrModalData] = useState<{
    open: boolean;
    orderId: number;
    customerName: string;
    expectedAmount: number;
    riderName?: string;
    hopStage: "RiderToStaff" | "StaffToOwner";
    heldByStaffName?: string | null;
    heldPaymentMethod?: string | null;
    riderSignedBy?: string | null;
  }>({
    open: false,
    orderId: 0,
    customerName: "",
    expectedAmount: 0,
    hopStage: "RiderToStaff",
  });

  const handleOpenRiderToStaff = (drop: PendingSettlementDrop) => {
    setQrModalData({
      open: true,
      orderId: drop.orderId || drop.id,
      customerName: drop.customerName,
      expectedAmount: drop.netRemittance,
      riderName: drop.riderName,
      hopStage: "RiderToStaff",
      heldByStaffName: drop.heldByStaffName,
      heldPaymentMethod: drop.heldPaymentMethod,
      riderSignedBy: drop.riderSignedBy,
    });
  };

  const handleOpenStaffToOwner = (drop: PendingSettlementDrop) => {
    setQrModalData({
      open: true,
      orderId: drop.orderId || drop.id,
      customerName: drop.customerName,
      expectedAmount: drop.netRemittance,
      riderName: drop.riderName,
      hopStage: "StaffToOwner",
      heldByStaffName: drop.heldByStaffName,
      heldPaymentMethod: drop.heldPaymentMethod,
      riderSignedBy: drop.riderSignedBy,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          Daily Manifest & Cash Reconciliation
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Two-Hop Custody & Tri-Stream Reconciliation Center — Settle returning freelance riders via one-time QR handshakes, track staff drawer custody, and remit to store owner.
        </p>
      </div>

      {/* Staff Drawer & Floating Custody Overview HUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: In Staff Drawer */}
        <div className="bg-stone-900/90 border border-amber-500/30 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="h-3 w-3 rounded-full bg-amber-400 inline-block mr-2 animate-pulse" />
              <span className="text-sm font-semibold text-amber-200">
                In Staff Drawer
              </span>
            </div>
            <span className="text-xs text-stone-400 bg-stone-800/80 px-2.5 py-0.5 rounded-full font-mono">
              {inDrawerCount} items
            </span>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono tracking-tight my-1">
            ₱{inDrawerTotal.toLocaleString()}
          </div>
          <p className="text-xs text-stone-400">
            Awaiting Owner Turnover (Hop 2)
          </p>
          {custodianBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-amber-500/20">
              <button
                type="button"
                onClick={() => setSelectedCustodian(null)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  selectedCustodian === null
                    ? "bg-amber-400 text-stone-950 font-bold shadow-xs"
                    : "bg-stone-800/80 text-amber-200/80 hover:bg-stone-800 hover:text-amber-100 border border-amber-500/30"
                }`}
              >
                All Custodians ({inDrawerCount})
              </button>
              {custodianBreakdown.map((cust) => (
                <button
                  key={cust.name}
                  type="button"
                  onClick={() => setSelectedCustodian(selectedCustodian === cust.name ? null : cust.name)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    selectedCustodian === cust.name
                      ? "bg-amber-400 text-stone-950 font-bold shadow-xs"
                      : "bg-stone-800/80 text-amber-200/80 hover:bg-stone-800 hover:text-amber-100 border border-amber-500/30"
                  }`}
                >
                  <span>👤 {cust.name}:</span>
                  <span className="font-mono font-bold">₱{cust.amount.toLocaleString()}</span>
                  <span className="text-[10px] opacity-80">({cust.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Uncollected */}
        <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="h-3 w-3 rounded-full bg-stone-400 inline-block mr-2" />
              <span className="text-sm font-semibold text-stone-200">
                Uncollected
              </span>
            </div>
            <span className="text-xs text-stone-400 bg-stone-800/80 px-2.5 py-0.5 rounded-full font-mono">
              {uncollectedCount} items
            </span>
          </div>
          <div className="text-3xl font-extrabold text-stone-100 font-mono tracking-tight my-1">
            ₱{uncollectedTotal.toLocaleString()}
          </div>
          <p className="text-xs text-stone-400">
            Road Riders & Counter Pickups
          </p>
        </div>
      </div>

      <Tabs defaultValue="riders" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 h-auto p-1.5 gap-1.5 bg-stone-200/60 rounded-xl mb-6">
          <TabsTrigger
            value="riders"
            className="flex items-center justify-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-lg transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm text-stone-600"
          >
            <span>🛵 Freelance Riders</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0 text-xs font-mono bg-stone-200 text-stone-800"
            >
              {drops.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="pickups"
            className="flex items-center justify-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-lg transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm text-stone-600"
          >
            <span>🏪 Store Pickups</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0 text-xs font-mono bg-stone-200 text-stone-800"
            >
              {pickupDrops.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="lalamove"
            className="flex items-center justify-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-lg transition-all data-active:bg-white data-active:text-stone-900 data-active:shadow-sm data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm text-stone-600"
          >
            <span>📦 Lalamove Couriers</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0 text-xs font-mono bg-stone-200 text-stone-800"
            >
              {lalamoveDrops.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Freelance Rider Remittance */}
        <TabsContent value="riders" className="space-y-4">
          <Card className="bg-white border border-stone-200/90 shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-stone-900">
                  Freelance Rider Collections ({drops.length})
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Two-Hop Custody Chain: Hop 1 transfers cash to Staff Drawer (Rider QR). Hop 2 remits drawer cash to Owner.
                </p>
              </div>
            </div>

            {isLoadingRiders ? (
              <div className="p-8 text-center text-stone-500">
                Loading pending rider reconciliations...
              </div>
            ) : (
              <div className="overflow-x-auto xl:overflow-x-hidden w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                      <th className="px-3 py-2.5">Rider</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2.5">Delivery Address</th>
                      <th className="px-3 py-2.5">Custody Status</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Collected</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap text-rose-700 bg-rose-50/40 border-l border-stone-200/80">
                        Rider Fee
                      </th>
                      <th className="px-3 py-2.5 text-right text-emerald-700 bg-emerald-50/40 whitespace-nowrap border-l border-stone-200/80">
                        Net Remittance
                      </th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {visibleDrops.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-10 text-center text-stone-500"
                        >
                          🎉 All caught up! No pending delivery drops to reconcile.
                        </td>
                      </tr>
                    ) : (
                      drops.map((drop: PendingSettlementDrop) => {
                        const isInDrawer = drop.custodyStatus === "InStaffDrawer";
                        const isWalkIn = isWalkInOrder(drop);
                        const schedule = formatSchedule(
                          drop.targetDeliveryTime ?? drop.riderDepartureTime,
                        );

                        return (
                          <tr
                            key={drop.id}
                            className={`hover:bg-stone-50/70 transition-colors ${
                              isWalkIn
                                ? "bg-indigo-50/40"
                                : isInDrawer
                                  ? "bg-amber-50/20"
                                  : ""
                            }`}
                          >
                            <td className="px-3 py-2.5 font-medium text-stone-900 text-xs">
                              <span className="truncate block max-w-[90px]" title={drop.riderName}>
                                {drop.riderName}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col gap-0.5 max-w-[150px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-xs font-semibold text-stone-500">
                                    #{drop.orderId || drop.id}
                                  </span>
                                  {drop.isTrustedCustomer && (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold shrink-0"
                                    >
                                      👑 VIP
                                    </Badge>
                                  )}
                                </div>
                                <span
                                  className="font-medium text-stone-900 text-xs leading-snug break-words line-clamp-1"
                                  title={drop.customerName}
                                >
                                  {drop.customerName}
                                </span>
                                <WalkInBadge
                                  source={drop.source}
                                  customerName={drop.customerName}
                                  facebookName={drop.facebookName}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-xs text-stone-700">
                              <div className="font-semibold text-xs text-stone-800 leading-tight">{schedule.date}</div>
                              <div className="font-mono text-[11px] text-stone-500 leading-tight">{schedule.time}</div>
                            </td>
                            <td className="px-3 py-2.5 text-stone-600 text-xs">
                              <div
                                className="whitespace-normal break-words max-w-[180px] lg:max-w-[200px] line-clamp-2 leading-tight"
                                title={drop.deliveryAddress || "Store Delivery"}
                              >
                                {drop.deliveryAddress || "Store Delivery"}
                              </div>
                            </td>

                            {/* Custody Status Badge - Stacked for Desktop Zero-Scroll */}
                            <td className="px-3 py-2.5 text-xs">
                              {isInDrawer ? (
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                    🟡 In Drawer
                                  </span>
                                  <span
                                    className="text-[11px] font-medium text-stone-600 pl-1 block truncate max-w-[140px]"
                                    title={`Held by ${drop.heldByStaffName || "Cashier"}`}
                                  >
                                    Held by {drop.heldByStaffName || "Cashier"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-stone-600 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                                  ⚪ Uncollected
                                </span>
                              )}
                            </td>

                            {/* Total Collected */}
                            <td className="px-3 py-2.5 text-right font-mono text-stone-800 text-xs tabular-nums whitespace-nowrap font-medium">
                              ₱{drop.totalCollected.toLocaleString()}
                            </td>

                            {/* Rider Fee - Distinct channel with vertical divider and soft rose tint */}
                            <td className="px-3 py-2.5 text-right font-mono text-rose-600 bg-rose-50/20 text-xs tabular-nums whitespace-nowrap border-l border-stone-200/80 font-medium">
                              - ₱{drop.riderDeliveryFee.toLocaleString()}
                            </td>

                            {/* Net Remittance - Distinct channel with vertical divider and soft emerald tint */}
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30 text-xs tabular-nums whitespace-nowrap border-l border-stone-200/80">
                              ₱{drop.netRemittance.toLocaleString()}
                            </td>

                            {/* Action Buttons */}
                            <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs">
                              {isInDrawer ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-xs h-8 px-2.5"
                                    onClick={() => handleOpenStaffToOwner(drop)}
                                  >
                                    👑 Remit
                                  </Button>
                                  {(isOwner ||
                                    (Boolean(user?.username) &&
                                      Boolean(drop.heldByStaffName) &&
                                      user!.username.toLowerCase() ===
                                        drop.heldByStaffName!.toLowerCase())) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 text-xs px-2 h-8"
                                      title="Revert Custody to Uncollected"
                                      disabled={revertCustodyMutation.isPending}
                                      onClick={() =>
                                        handleRevertCustody(drop.orderId || drop.id)
                                      }
                                    >
                                      ↩️
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs h-8 px-2.5"
                                  onClick={() => handleOpenRiderToStaff(drop)}
                                >
                                  Settle Payment
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
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Walk-in Store Pickup Handovers */}
        <TabsContent value="pickups" className="space-y-4">
          <PickupSettlementTab />
        </TabsContent>

        {/* Tab 3: Lalamove Courier Gate */}
        <TabsContent value="lalamove" className="space-y-4">
          <LalamoveSettlementTab />
        </TabsContent>
      </Tabs>

      {/* Two-Hop QR Settlement Modal */}
      {qrModalData.open && (
        <QrSettlementModal
          open={qrModalData.open}
          onOpenChange={(open) =>
            setQrModalData((prev) => ({ ...prev, open }))
          }
          orderId={qrModalData.orderId}
          customerName={qrModalData.customerName}
          expectedAmount={qrModalData.expectedAmount}
          riderName={qrModalData.riderName}
          hopStage={qrModalData.hopStage}
          heldByStaffName={qrModalData.heldByStaffName}
          heldPaymentMethod={qrModalData.heldPaymentMethod}
          riderSignedBy={qrModalData.riderSignedBy}
          onSuccess={() => {
            setQrModalData((prev) => ({ ...prev, open: false }));
          }}
        />
      )}
    </div>
  );
}
