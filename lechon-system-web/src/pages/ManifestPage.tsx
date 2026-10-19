import { useState } from "react";
import {
  usePendingSettlements,
  usePendingPickupsQuery,
  usePendingLalamoveQuery,
  useRevertCustodyMutation,
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

export default function ManifestPage() {
  const { user, isOwner } = useAuth();
  const { data: drops = [], isLoading: isLoadingRiders } = usePendingSettlements();
  const { data: pickupDrops = [] } = usePendingPickupsQuery();
  const { data: lalamoveDrops = [] } = usePendingLalamoveQuery();
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
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          Daily Manifest & Cash Reconciliation
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Two-Hop Custody & Tri-Stream Reconciliation Center — Settle returning freelance riders via one-time QR handshakes, track staff drawer custody, and remit to store owner.
        </p>
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
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-600 font-semibold uppercase tracking-wider text-xs">
                      <th className="px-3 py-3">Rider</th>
                      <th className="px-3 py-3 max-w-[160px]">Customer</th>
                      <th className="px-3 py-3 max-w-[180px] lg:max-w-[220px]">Delivery Address</th>
                      <th className="px-3 py-3">Custody Status</th>
                      <th className="px-3 py-3 text-right">Total Collected</th>
                      <th className="px-3 py-3 text-right">Rider Fee</th>
                      <th className="px-3 py-3 text-right text-emerald-700 bg-emerald-50/30">
                        Net Remittance
                      </th>
                      <th className="px-3 py-3 w-[140px] text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {drops.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-10 text-center text-stone-500"
                        >
                          🎉 All caught up! No pending delivery drops to reconcile.
                        </td>
                      </tr>
                    ) : (
                      drops.map((drop: PendingSettlementDrop) => {
                        const isInDrawer = drop.custodyStatus === "InStaffDrawer";

                        return (
                          <tr
                            key={drop.id}
                            className={`hover:bg-stone-50/70 transition-colors ${
                              isInDrawer ? "bg-amber-50/20" : ""
                            }`}
                          >
                            <td className="px-3 py-3 font-medium text-stone-900 text-xs sm:text-sm">
                              {drop.riderName}
                            </td>
                            <td className="px-3 py-2.5 min-w-[140px] max-w-[200px]">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
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
                                  className="font-medium text-stone-900 text-xs sm:text-sm leading-snug break-words"
                                  title={drop.customerName}
                                >
                                  {drop.customerName}
                                </span>
                              </div>
                            </td>
                            <td
                              className="px-3 py-3 text-stone-500 text-xs sm:text-sm max-w-[180px] lg:max-w-[220px] truncate"
                              title={drop.deliveryAddress || "Store Delivery"}
                            >
                              {drop.deliveryAddress || "Store Delivery"}
                            </td>

                            {/* Custody Status Badge */}
                            <td className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm">
                              {isInDrawer ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-900 border-amber-300 text-xs font-semibold py-1 px-2.5 flex items-center gap-1.5 w-fit shadow-xs"
                                >
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  <span>
                                    🟡 In Staff Drawer: Held by {drop.heldByStaffName || "Cashier"}
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

                            <td className="px-3 py-3 text-right font-mono text-stone-800 text-xs sm:text-sm">
                              ₱{drop.totalCollected.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-rose-600 text-xs sm:text-sm">
                              - ₱{drop.riderDeliveryFee.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-600 bg-emerald-50/20 text-xs sm:text-sm">
                              ₱{drop.netRemittance.toLocaleString()}
                            </td>

                            {/* Action Buttons */}
                            <td className="px-3 py-3 w-[140px] text-center whitespace-nowrap text-xs sm:text-sm">
                              {isInDrawer ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button
                                    size="sm"
                                    className="bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-xs"
                                    onClick={() => handleOpenStaffToOwner(drop)}
                                  >
                                    👑 Remit to Owner
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
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs"
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
