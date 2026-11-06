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
import { Input } from "@/components/ui/input";
import { PickupSettlementTab } from "@/components/manifest/PickupSettlementTab";
import { LalamoveSettlementTab } from "@/components/manifest/LalamoveSettlementTab";
import { QrSettlementModal } from "@/components/manifest/QrSettlementModal";
import OrderDetailsModal from "@/components/ui/orders/OrderDetailsModal";
import { toast } from "sonner";
import { WalkInBadge } from "@/components/WalkInBadge";
import { isWalkInOrder } from "@/utils/walkIn";
import {
  Bike,
  Store,
  Package,
  RotateCcw,
  HandCoins,
  Banknote,
  Search,
  X,
} from "lucide-react";

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

  const {
    inDrawerTotal,
    inDrawerCount,
    uncollectedTotal,
    uncollectedCount,
    pendingDigitalTotal,
    pendingDigitalCount,
  } =
    useMemo(() => {
      return computeCustodyMetrics(drops, pickupDrops);
    }, [drops, pickupDrops]);

  const [selectedCustodian, setSelectedCustodian] = useState<string | null>(null);

  const inDrawerItems = useMemo(() => {
    const riderInDrawer = drops
      .filter((d) => (d.settlementCustodyStatus || d.custodyStatus) === "InStaffDrawer")
      .map((d) => ({
        amount: Number(d.heldByStaffAmount ?? 0),
        custodian: d.heldByStaffName?.trim() || "Staff",
      }))
      .filter((item) => item.amount > 0);

    const pickupInDrawer = pickupDrops
      .filter((p) => (p.settlementCustodyStatus || p.custodyStatus) === "InStaffDrawer")
      .map((p) => ({
        amount: Number(p.heldByStaffAmount ?? 0),
        custodian: p.heldByStaffName?.trim() || "Staff",
      }))
      .filter((item) => item.amount > 0);

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

  // Real-time search query and dossier modal states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDossierOrderId, setSelectedDossierOrderId] = useState<number | null>(null);

  const filteredDrops = useMemo(() => {
    if (!searchQuery.trim()) return visibleDrops;
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.startsWith("#") ? q.slice(1) : q;
    return visibleDrops.filter((drop) => {
      const orderIdStr = String(drop.orderId || drop.id || "");
      const customer = (drop.customerName || "").toLowerCase();
      const rider = (drop.riderName || "").toLowerCase();
      const address = (drop.deliveryAddress || "").toLowerCase();
      const isNoRider =
        !drop.riderName?.trim() ||
        drop.riderName.trim().toLowerCase() === "unassigned";

      return (
        orderIdStr.includes(cleanQ) ||
        customer.includes(q) ||
        rider.includes(q) ||
        address.includes(q) ||
        (isNoRider && (q.includes("no rider") || q.includes("unassigned")))
      );
    });
  }, [visibleDrops, searchQuery]);

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
    totalCollected: number;
    deliveryFee: number;
    heldByStaffAmount?: number | null;
    digitalTransferMethod?: string | null;
    digitalTransferAmount?: number | null;
    digitalReferenceNote?: string | null;
  }>({
    open: false,
    orderId: 0,
    customerName: "",
    expectedAmount: 0,
    totalCollected: 0,
    deliveryFee: 0,
    hopStage: "RiderToStaff",
  });

  const handleOpenRiderToStaff = (drop: PendingSettlementDrop) => {
    setQrModalData({
      open: true,
      orderId: drop.orderId || drop.id,
      customerName: drop.customerName,
      expectedAmount: drop.netRemittance,
      totalCollected: drop.totalCollected,
      deliveryFee: drop.riderDeliveryFee,
      riderName: drop.riderName,
      hopStage: "RiderToStaff",
      heldByStaffName: drop.heldByStaffName,
      heldPaymentMethod: drop.heldPaymentMethod,
      riderSignedBy: drop.riderSignedBy,
      heldByStaffAmount: drop.heldByStaffAmount,
      digitalTransferMethod: drop.digitalTransferMethod,
      digitalTransferAmount: drop.digitalTransferAmount,
      digitalReferenceNote: drop.digitalReferenceNote,
    });
  };

  const handleOpenStaffToOwner = (drop: PendingSettlementDrop) => {
    setQrModalData({
      open: true,
      orderId: drop.orderId || drop.id,
      customerName: drop.customerName,
      expectedAmount:
        Number(drop.heldByStaffAmount ?? 0) > 0
          ? Number(drop.heldByStaffAmount)
          : Number(drop.digitalTransferAmount ?? drop.netRemittance),
      totalCollected: drop.totalCollected,
      deliveryFee: drop.riderDeliveryFee,
      riderName: drop.riderName,
      hopStage: "StaffToOwner",
      heldByStaffName: drop.heldByStaffName,
      heldPaymentMethod: drop.heldPaymentMethod,
      riderSignedBy: drop.riderSignedBy,
      heldByStaffAmount: drop.heldByStaffAmount,
      digitalTransferMethod: drop.digitalTransferMethod,
      digitalTransferAmount: drop.digitalTransferAmount,
      digitalReferenceNote: drop.digitalReferenceNote,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">
              Daily Manifest &amp; Cash Reconciliation
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs py-0.5">
              Two-Hop Custody
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Real-time reconciliation across freelance dispatch riders, store counter pickups, and courier dispatches.
          </p>
        </div>
      </div>

      {/* REFINED EXECUTIVE FINANCIAL SCOREBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: In Staff Drawer */}
        <div className="bg-gradient-to-br from-[#1C1917] via-[#24201D] to-[#1C1917] border border-amber-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Physical Cash in Drawer
              </span>
            </div>
            <span className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
              {inDrawerCount} {inDrawerCount === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight my-1.5 relative z-10">
            ₱{inDrawerTotal.toLocaleString()}
          </div>
          <p className="text-xs text-stone-400 relative z-10">
            Hop 2 • Physical cash only; digital deposits are excluded
          </p>
          {custodianBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-amber-500/20 relative z-10">
              <button
                type="button"
                onClick={() => setSelectedCustodian(null)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedCustodian === null
                    ? "bg-amber-400 text-stone-950 font-bold shadow-xs"
                    : "bg-stone-800/90 text-amber-200/90 hover:bg-stone-800 hover:text-white border border-amber-500/30"
                }`}
              >
                All Custodians ({inDrawerCount})
              </button>
              {custodianBreakdown.map((cust) => (
                <button
                  key={cust.name}
                  type="button"
                  onClick={() => setSelectedCustodian(selectedCustodian === cust.name ? null : cust.name)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCustodian === cust.name
                      ? "bg-amber-400 text-stone-950 font-bold shadow-xs"
                      : "bg-stone-800/90 text-amber-200/90 hover:bg-stone-800 hover:text-white border border-amber-500/30"
                  }`}
                >
                  <span>👤 {cust.name}:</span>
                  <span className="font-mono font-bold">₱{cust.amount.toLocaleString()}</span>
                  <span className="text-[10.5px] opacity-75 font-normal">({cust.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Pending Owner Digital Check */}
        <div className="bg-gradient-to-br from-sky-950 via-sky-900 to-sky-950 border border-sky-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-200">
              Pending Owner Digital Check
            </span>
            <span className="text-xs text-sky-100 bg-sky-500/10 border border-sky-400/30 px-2.5 py-0.5 rounded-full font-mono font-semibold">
              {pendingDigitalCount} {pendingDigitalCount === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-sky-300 font-mono tracking-tight my-1.5 relative z-10">
            ₱{pendingDigitalTotal.toLocaleString()}
          </div>
          <p className="text-xs text-sky-100/70 relative z-10">
            Bank, Direct GCash, GCash, and Maya awaiting Owner account verification
          </p>
        </div>

        {/* Card 3: Uncollected */}
        <div className="bg-gradient-to-br from-[#1C1917] via-[#22201E] to-[#1C1917] border border-stone-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-stone-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-stone-400 inline-block" />
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                Uncollected Balance
              </span>
            </div>
            <span className="text-xs text-stone-300 bg-stone-800 border border-stone-700 px-2.5 py-0.5 rounded-full font-mono font-semibold">
              {uncollectedCount} {uncollectedCount === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-stone-100 font-mono tracking-tight my-1.5 relative z-10">
            ₱{uncollectedTotal.toLocaleString()}
          </div>
          <p className="text-xs text-stone-400 relative z-10">
            Hop 1 • Road delivery collections &amp; awaiting counter store pickups
          </p>
        </div>
      </div>

      {/* MODERN TABS SWITCHER WITH REAL-TIME MULTI-FIELD SEARCH */}
      <Tabs defaultValue="riders" className="w-full space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="w-full sm:w-auto inline-flex h-auto p-1 bg-stone-200/80 rounded-xl border border-stone-300/60 gap-1 shrink-0">
            <TabsTrigger
              value="riders"
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs text-stone-600 transition-all cursor-pointer"
            >
              <Bike className="w-4 h-4 text-amber-700" />
              <span>Freelance Riders</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 text-xs font-mono bg-stone-100 text-stone-800 border border-stone-300"
              >
                {drops.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="pickups"
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs text-stone-600 transition-all cursor-pointer"
            >
              <Store className="w-4 h-4 text-emerald-700" />
              <span>Store Pickups</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 text-xs font-mono bg-stone-100 text-stone-800 border border-stone-300"
              >
                {pickupDrops.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="lalamove"
              className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-xs text-stone-600 transition-all cursor-pointer"
            >
              <Package className="w-4 h-4 text-orange-700" />
              <span>Lalamove Couriers</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 text-xs font-mono bg-stone-100 text-stone-800 border border-stone-300"
              >
                {lalamoveDrops.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Real-time Search Input Bar */}
          <div className="relative w-full sm:w-80 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search customer, #order, rider, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-white border-stone-300 rounded-xl shadow-2xs focus-visible:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Freelance Rider Remittance */}
        <TabsContent value="riders" className="space-y-4">
          <Card className="bg-white border border-stone-200/90 shadow-sm rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-stone-50/70 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-900 rounded-lg">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                      Freelance Rider Collections ({filteredDrops.length})
                    </h3>
                    {searchQuery.trim() && (
                      <Badge variant="outline" className="text-[11px] font-normal text-stone-600 bg-white">
                        Showing {filteredDrops.length} of {visibleDrops.length} drops
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">
                    Two-Hop verification: physical cash enters the Staff Drawer; direct digital payments await Owner account confirmation.
                  </p>
                </div>
              </div>
            </div>

            {isLoadingRiders ? (
              <div className="p-8 text-center text-stone-500">
                Loading pending rider reconciliations...
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[1150px]">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-100/80 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="px-3.5 py-2.5">Rider</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Date &amp; Time</th>
                      <th className="px-3 py-2.5">Delivery Address</th>
                      <th className="px-3 py-2.5">Custody Status</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Collected</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap text-rose-700 bg-rose-50/50 border-l border-stone-200">
                        Rider Fee
                      </th>
                      <th className="px-3 py-2.5 text-right text-emerald-700 bg-emerald-50/50 whitespace-nowrap border-l border-stone-200 font-bold">
                        Net Remittance
                      </th>
                      <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {filteredDrops.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-10 text-center text-stone-500"
                        >
                          {visibleDrops.length === 0 ? (
                            "🎉 All caught up! No pending delivery drops to reconcile."
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Search className="w-6 h-6 text-stone-400" />
                              <p className="text-sm font-medium text-stone-700">
                                No drops matching &quot;{searchQuery}&quot;
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSearchQuery("")}
                                className="mt-1 h-7 text-xs cursor-pointer border-stone-300"
                              >
                                Clear Search
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredDrops.map((drop: PendingSettlementDrop) => {
                        const isInDrawer = drop.custodyStatus === "InStaffDrawer";
                        const isAwaitingDigital =
                          drop.custodyStatus === "AwaitingOwnerDigitalVerification";
                        const isAwaitingOwner = isInDrawer || isAwaitingDigital;
                        const isUnassignedRider =
                          !drop.riderName?.trim() ||
                          drop.riderName.trim().toLowerCase() === "unassigned";
                        const isWalkIn = isWalkInOrder(drop);
                        const schedule = formatSchedule(
                          drop.targetDeliveryTime ?? drop.riderDepartureTime,
                        );

                        return (
                          <tr
                            key={drop.id}
                            className={`hover:bg-amber-50/30 transition-colors ${
                              isWalkIn
                                ? "bg-indigo-50/40"
                                : isInDrawer
                                  ? "bg-amber-50/20"
                                  : ""
                            }`}
                          >
                            <td className="px-3.5 py-2.5 font-medium text-stone-900 text-xs">
                              {isUnassignedRider ? (
                                <Badge className="bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-50 font-bold px-2 py-0.5 rounded text-xs shadow-2xs">
                                  ⚠️ No Rider
                                </Badge>
                              ) : isAwaitingDigital ? (
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-xs font-bold text-sky-900 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-full">
                                    🏦 Awaiting Bank Check
                                  </span>
                                  <span className="text-[11px] text-sky-800 max-w-[160px] break-words">
                                    {drop.digitalReferenceNote || "Reference note pending"}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-semibold text-stone-900 block truncate" title={drop.riderName}>
                                  {drop.riderName}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col gap-0.5 max-w-[150px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDossierOrderId(drop.orderId || drop.id)}
                                    className="font-mono text-xs font-bold text-stone-700 hover:text-amber-800 hover:underline cursor-pointer transition-colors"
                                    title="Open Order Dossier"
                                  >
                                    #{drop.orderId || drop.id}
                                  </button>
                                  {drop.isTrustedCustomer && (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold shrink-0"
                                    >
                                      👑 VIP
                                    </Badge>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDossierOrderId(drop.orderId || drop.id)}
                                  className="text-left font-semibold text-stone-900 text-xs leading-snug break-words line-clamp-1 hover:text-amber-800 hover:underline cursor-pointer transition-colors"
                                  title={`Open Dossier for ${drop.customerName}`}
                                >
                                  {drop.customerName}
                                </button>
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
                                    title={`Held by ${drop.heldByStaffName || "Cashier"}`}
                                  >
                                    Held by {drop.heldByStaffName || "Cashier"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-stone-600 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                                  Uncollected
                                </span>
                              )}
                            </td>

                            {/* Total Collected */}
                            <td className="px-3 py-2.5 text-right font-mono text-stone-800 text-xs tabular-nums whitespace-nowrap font-medium">
                              ₱{drop.totalCollected.toLocaleString()}
                            </td>

                            {/* Rider Fee */}
                            <td className="px-3 py-2.5 text-right font-mono text-rose-600 bg-rose-50/30 text-xs tabular-nums whitespace-nowrap border-l border-stone-200 font-medium">
                              - ₱{drop.riderDeliveryFee.toLocaleString()}
                            </td>

                            {/* Net Remittance */}
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40 text-xs tabular-nums whitespace-nowrap border-l border-stone-200">
                              ₱{drop.netRemittance.toLocaleString()}
                            </td>

                            {/* REFINED, COHESIVE ACTIONS COLUMN (UNIFORM ALIGNED WIDTH) */}
                            <td className="px-3.5 py-2.5 text-right whitespace-nowrap text-xs">
                              <div className="w-[152px] flex items-center justify-end gap-1.5 ml-auto">
                                {isAwaitingOwner ? (
                                  <>
                                    <Button
                                      size="sm"
                                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold shadow-2xs h-8 px-2.5 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                      onClick={() => handleOpenStaffToOwner(drop)}
                                    >
                                      <HandCoins className="w-3.5 h-3.5 shrink-0" />
                                      <span>Remit</span>
                                    </Button>
                                    {(isOwner ||
                                      (Boolean(user?.username) &&
                                        Boolean(drop.heldByStaffName) &&
                                        user!.username.toLowerCase() ===
                                          drop.heldByStaffName!.toLowerCase())) && (
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border-stone-200 rounded-lg cursor-pointer shrink-0"
                                        title="Revert Custody to Uncollected"
                                        disabled={revertCustodyMutation.isPending}
                                        onClick={() =>
                                          handleRevertCustody(drop.orderId || drop.id)
                                        }
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs h-8 px-2.5 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                    onClick={() => handleOpenRiderToStaff(drop)}
                                  >
                                    {isUnassignedRider ? (
                                      <>
                                        <Bike className="w-3.5 h-3.5 shrink-0" />
                                        <span>Assign &amp; Settle</span>
                                      </>
                                    ) : (
                                      <>
                                        <Banknote className="w-3.5 h-3.5 shrink-0" />
                                        <span>Settle Drop</span>
                                      </>
                                    )}
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
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Walk-in Store Pickup Handovers */}
        <TabsContent value="pickups" className="space-y-4">
          <PickupSettlementTab
            selectedCustodian={selectedCustodian}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery("")}
            onSelectOrder={setSelectedDossierOrderId}
          />
        </TabsContent>

        {/* Tab 3: Lalamove Courier Gate */}
        <TabsContent value="lalamove" className="space-y-4">
          <LalamoveSettlementTab
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery("")}
            onSelectOrder={setSelectedDossierOrderId}
          />
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
          totalCollected={qrModalData.totalCollected}
          deliveryFee={qrModalData.deliveryFee}
          riderName={qrModalData.riderName}
          hopStage={qrModalData.hopStage}
          heldByStaffName={qrModalData.heldByStaffName}
          heldPaymentMethod={qrModalData.heldPaymentMethod}
          riderSignedBy={qrModalData.riderSignedBy}
          heldByStaffAmount={qrModalData.heldByStaffAmount}
          digitalTransferMethod={qrModalData.digitalTransferMethod}
          digitalTransferAmount={qrModalData.digitalTransferAmount}
          digitalReferenceNote={qrModalData.digitalReferenceNote}
          onSuccess={() => {
            setQrModalData((prev) => ({ ...prev, open: false }));
          }}
        />
      )}

      {/* In-Modal Slide-out Order Details Dossier */}
      <OrderDetailsModal
        orderId={selectedDossierOrderId}
        isOpen={selectedDossierOrderId !== null}
        onClose={() => setSelectedDossierOrderId(null)}
      />
    </div>
  );
}
