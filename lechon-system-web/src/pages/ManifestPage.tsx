import { useState } from "react";
import {
  usePendingSettlements,
  usePendingPickupsQuery,
  usePendingLalamoveQuery,
  PendingSettlementDrop,
} from "@/hooks/useManifest";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PickupSettlementTab } from "@/components/manifest/PickupSettlementTab";
import { LalamoveSettlementTab } from "@/components/manifest/LalamoveSettlementTab";
import { QrSettlementModal } from "@/components/manifest/QrSettlementModal";

export default function ManifestPage() {
  const { data: drops = [], isLoading: isLoadingRiders } = usePendingSettlements();
  const { data: pickupDrops = [] } = usePendingPickupsQuery();
  const { data: lalamoveDrops = [] } = usePendingLalamoveQuery();

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Daily Manifest & Cash Reconciliation
        </h1>
        <p className="text-muted-foreground mt-1">
          Two-Hop Custody & Tri-Stream Reconciliation Center — Settle returning freelance riders via one-time QR handshakes, track staff drawer custody, and remit to store owner.
        </p>
      </div>

      <Tabs defaultValue="riders" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 h-10 p-1 bg-slate-100 border border-slate-200">
          <TabsTrigger
            value="riders"
            className="flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm data-active:bg-white data-active:shadow-sm"
          >
            <span>🛵 Freelance Riders</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0 text-xs font-mono bg-slate-200 text-slate-800"
            >
              {drops.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="pickups"
            className="flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm data-active:bg-white data-active:shadow-sm"
          >
            <span>🏪 Store Pickups</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0 text-xs font-mono bg-slate-200 text-slate-800"
            >
              {pickupDrops.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="lalamove"
            className="flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm data-active:bg-white data-active:shadow-sm"
          >
            <span>📦 Lalamove Couriers</span>
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0 text-xs font-mono bg-slate-200 text-slate-800"
            >
              {lalamoveDrops.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Freelance Rider Remittance */}
        <TabsContent value="riders" className="space-y-4">
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-800">
                  Freelance Rider Collections ({drops.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Two-Hop Custody Chain: Hop 1 transfers cash to Staff Drawer (Rider QR). Hop 2 remits drawer cash to Owner.
                </p>
              </div>
            </div>

            {isLoadingRiders ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading pending rider reconciliations...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                      <th className="p-4">Rider</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Delivery Address</th>
                      <th className="p-4">Custody Status</th>
                      <th className="p-4 text-right">Total Collected</th>
                      <th className="p-4 text-right">Rider Fee</th>
                      <th className="p-4 text-right text-emerald-700 bg-emerald-50/30">
                        Net Remittance
                      </th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {drops.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-10 text-center text-muted-foreground"
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
                            className={`hover:bg-slate-50/50 transition-colors ${
                              isInDrawer ? "bg-amber-50/20" : ""
                            }`}
                          >
                            <td className="p-4 font-medium text-slate-900">
                              {drop.riderName}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800">
                                  #{drop.orderId || drop.id} • {drop.customerName}
                                </span>
                                {drop.isTrustedCustomer && (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-800 border-amber-300 text-xs"
                                  >
                                    👑 VIP
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground max-w-xs truncate">
                              {drop.deliveryAddress || "Store Delivery"}
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
                                    🟡 In Staff Drawer: Held by {drop.heldByStaffName || "Cashier"}
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

                            <td className="p-4 text-right font-mono">
                              ₱{drop.totalCollected.toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono text-red-600">
                              - ₱{drop.riderDeliveryFee.toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono font-semibold text-emerald-600 bg-emerald-50/20">
                              ₱{drop.netRemittance.toLocaleString()}
                            </td>

                            {/* Action Buttons */}
                            <td className="p-4 text-center whitespace-nowrap">
                              {isInDrawer ? (
                                <Button
                                  size="sm"
                                  className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-sm"
                                  onClick={() => handleOpenStaffToOwner(drop)}
                                >
                                  👑 Remit to Owner
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
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
