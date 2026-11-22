import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import {
  DownpaymentTrackerItem,
  useToggleDownpaymentRemittanceMutation,
} from "@/hooks/useManifest";
import { toast } from "sonner";
import { isWalkInOrder } from "@/utils/walkIn";
import { Search } from "lucide-react";

type DownpaymentFilter =
  | "all"
  | "cash"
  | "digital"
  | "walkin"
  | "unremitted"
  | "remitted";

export interface DownpaymentTrackerTabProps {
  items: DownpaymentTrackerItem[];
  isLoading?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSelectOrder?: (orderId: number) => void;
}

const money = (value: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const normalizeMethod = (method?: string | null) =>
  (method || "").toLowerCase().replace(/[\s-_]+/g, "");

const isCashMethod = (method?: string | null) => {
  const normalized = normalizeMethod(method);
  return normalized === "cash" || normalized === "countercash";
};

const isDigitalMethod = (method?: string | null) => {
  const normalized = normalizeMethod(method);
  return [
    "gcash",
    "directgcash",
    "manualgcash",
    "maya",
    "banktransfer",
  ].includes(normalized);
};

const isWalkIn = (item: DownpaymentTrackerItem) =>
  isWalkInOrder({ source: item.bookingSource, customerName: item.customerName });

const getDpAmount = (item: DownpaymentTrackerItem): number =>
  Number(item.amount ?? item.downpaymentAmount ?? 0);

const getDpMethod = (item: DownpaymentTrackerItem): string =>
  item.paymentMethod || item.downpaymentMethod || "Cash";

const getIsRemitted = (item: DownpaymentTrackerItem): boolean =>
  Boolean(item.isRemittedToOwner ?? item.isDpRemittedToOwner);

const getRemittedAt = (item: DownpaymentTrackerItem): string | null | undefined =>
  item.remittedAt ?? item.dpRemittedAt;

const getRemittedBy = (item: DownpaymentTrackerItem): string | null | undefined =>
  item.remittedBy ?? item.dpRemittedBy;

const getEventDate = (item: DownpaymentTrackerItem): string | null | undefined =>
  item.eventDate ?? item.targetDeliveryTime;

const getPaidAt = (item: DownpaymentTrackerItem): string | null | undefined =>
  item.paidAt ?? item.createdAt;

const sortByEventDate = (
  a: DownpaymentTrackerItem,
  b: DownpaymentTrackerItem,
) => {
  const aDate = getEventDate(a);
  const bDate = getEventDate(b);
  const aIsTbd = Boolean(a.isDateTbd || !aDate);
  const bIsTbd = Boolean(b.isDateTbd || !bDate);
  if (aIsTbd !== bIsTbd) return aIsTbd ? 1 : -1;

  const aTime = aIsTbd
    ? Number.POSITIVE_INFINITY
    : new Date(aDate!).getTime();
  const bTime = bIsTbd
    ? Number.POSITIVE_INFINITY
    : new Date(bDate!).getTime();
  const safeATime = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
  const safeBTime = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
  if (safeATime !== safeBTime) return safeATime - safeBTime;

  const aPaid = getPaidAt(a);
  const bPaid = getPaidAt(b);
  const aPaidTime = aPaid ? new Date(aPaid).getTime() : 0;
  const bPaidTime = bPaid ? new Date(bPaid).getTime() : 0;
  if (aPaidTime !== bPaidTime) return aPaidTime - bPaidTime;

  const aLogId = a.paymentLogId ?? 0;
  const bLogId = b.paymentLogId ?? 0;
  if (aLogId !== bLogId) return aLogId - bLogId;

  return Number(a.orderId) - Number(b.orderId);
};

const formatDate = (value?: string | null) => {
  if (!value) return "Date TBD";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "Date TBD";
  const parsed = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
  );
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() + 1 !== Number(match[2]) ||
    parsed.getUTCDate() !== Number(match[3])
  ) {
    return "Date TBD";
  }
  return parsed.toLocaleDateString("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function DownpaymentTrackerTab({
  items,
  isLoading = false,
  searchQuery = "",
  onClearSearch,
  onSelectOrder,
}: DownpaymentTrackerTabProps) {
  const { isOwner } = useAuth();
  // Default filter pill is [ ⏳ Unremitted ]
  const [filter, setFilter] = useState<DownpaymentFilter>("unremitted");
  const [visibleCount, setVisibleCount] = useState<number>(30);
  const toggleRemittance = useToggleDownpaymentRemittanceMutation();

  useEffect(() => {
    setVisibleCount(30);
  }, [filter, searchQuery]);

  const payableItems = useMemo(
    () => items.filter((item) => getDpAmount(item) > 0),
    [items],
  );

  const summary = useMemo(
    () =>
      payableItems.reduce(
        (totals, item) => {
          const amount = getDpAmount(item);
          const remitted = getIsRemitted(item);
          const method = getDpMethod(item);

          if (remitted) {
            totals.verified += amount;
          } else if (isCashMethod(method)) {
            totals.unremittedCash += amount;
            totals.unremittedCashCount += 1;
            totals.unremittedCount += 1;
          } else if (isDigitalMethod(method)) {
            totals.unverifiedDigital += amount;
            totals.unremittedCount += 1;
          } else {
            totals.unremittedCount += 1;
          }
          return totals;
        },
        {
          unremittedCash: 0,
          unverifiedDigital: 0,
          verified: 0,
          unremittedCashCount: 0,
          unremittedCount: 0,
        },
      ),
    [payableItems],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.startsWith("#") ? q.slice(1) : q;

    return payableItems
      .filter((item) => {
        const method = getDpMethod(item);
        const isRemitted = getIsRemitted(item);

        // 1. Text Search Filter across customerName, orderReference, orderId, phoneNumber, downpaymentMethod, bookingSource, encodedBy
        if (cleanQ) {
          const matchCustomer = item.customerName?.toLowerCase().includes(cleanQ);
          const matchRef = item.orderReference?.toLowerCase().includes(cleanQ);
          const matchId = String(item.orderId).includes(cleanQ);
          const matchPhone = item.phoneNumber?.toLowerCase().includes(cleanQ);
          const matchMethod = method.toLowerCase().includes(cleanQ);
          const matchSource = item.bookingSource?.toLowerCase().includes(cleanQ);
          const matchEncoder = item.encodedBy?.toLowerCase().includes(cleanQ);

          if (
            !matchCustomer &&
            !matchRef &&
            !matchId &&
            !matchPhone &&
            !matchMethod &&
            !matchSource &&
            !matchEncoder
          ) {
            return false;
          }
        }

        // 2. Filter Pill
        switch (filter) {
          case "cash":
            return isCashMethod(method);
          case "digital":
            return isDigitalMethod(method);
          case "walkin":
            return isWalkIn(item);
          case "unremitted":
            return !isRemitted;
          case "remitted":
            return isRemitted;
          default:
            return true;
        }
      })
      .sort(sortByEventDate);
  }, [filter, payableItems, searchQuery]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  const filters: Array<{ value: DownpaymentFilter; label: string }> = [
    {
      value: "unremitted",
      label: `⏳ Unremitted (${summary.unremittedCount})`,
    },
    { value: "all", label: "All DPs" },
    { value: "cash", label: "💵 Cash DP Only" },
    { value: "digital", label: "📱 Digital DP (GCash/Maya/Bank)" },
    { value: "walkin", label: "🚶 Walk-In Only" },
    { value: "remitted", label: "✅ Remitted to Owner" },
  ];

  const handleToggle = (item: DownpaymentTrackerItem) => {
    const isRemitted = getIsRemitted(item);
    toggleRemittance.mutate(
      { paymentLogId: item.paymentLogId, orderId: item.orderId },
      {
        onSuccess: () =>
          toast.success(
            isRemitted
              ? `Order #${item.orderReference} returned to Unremitted.`
              : `Order #${item.orderReference} DP marked as remitted to Owner!`,
          ),
        onError: () => toast.error("Could not update the DP remittance status."),
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* 3-Box Summary Strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-900">
            ⏳ Unremitted Cash DP (Held by Staff)
          </div>
          <div className="mt-1 font-mono text-2xl font-black text-amber-950">
            {money(summary.unremittedCash)}
          </div>
          <div className="mt-1 text-xs text-amber-800">
            {summary.unremittedCashCount} cash downpayment
            {summary.unremittedCashCount === 1 ? "" : "s"} waiting for Owner
            remittance
          </div>
        </div>

        <div className="rounded-xl border border-sky-300 bg-sky-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-sky-900">
            📱 Unverified Digital DP (Direct to Owner)
          </div>
          <div className="mt-1 font-mono text-2xl font-black text-sky-950">
            {money(summary.unverifiedDigital)}
          </div>
          <div className="mt-1 text-xs text-sky-800">
            GCash, Maya, &amp; Bank Transfers deposited straight to Owner
            accounts
          </div>
        </div>

        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-900">
            ✅ Verified / Remitted DP
          </div>
          <div className="mt-1 font-mono text-2xl font-black text-emerald-950">
            {money(summary.verified)}
          </div>
          <div className="mt-1 text-xs text-emerald-800">
            Total advance deposits cleared and acknowledged by Owner
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden border border-stone-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50/70 p-4">
          <div>
            <h3 className="font-bold text-stone-900">
              Downpayment Remittance Ledger
            </h3>
            <p className="text-xs text-stone-500">
              Track cashier cash holdings vs. direct digital deposits per
              advance booking
            </p>
          </div>
          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  type="button"
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? "bg-amber-800 text-white shadow-2xs"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/80 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                <th className="px-4 py-3">Customer &amp; Mode</th>
                <th className="px-4 py-3 text-right">DP Amount</th>
                <th className="px-4 py-3">Event Date</th>
                <th className="px-4 py-3">Owner Verification / Remittance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-sm text-stone-500"
                  >
                    Loading downpayments...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-sm text-stone-500"
                  >
                    {searchQuery ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="h-6 w-6 text-stone-400" />
                        <p className="font-semibold text-stone-700">
                          No downpayments found matching "{searchQuery}"
                        </p>
                        <p className="text-xs text-stone-500">
                          Try searching by customer name, order number, phone,
                          or payment mode.
                        </p>
                        {onClearSearch && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClearSearch}
                            className="mt-2 text-xs"
                          >
                            Clear Search
                          </Button>
                        )}
                      </div>
                    ) : (
                      "No downpayments match this filter."
                    )}
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => {
                  const method = getDpMethod(item);
                  const cash = isCashMethod(method);
                  const rowKey = item.paymentLogId
                    ? `log-${item.paymentLogId}`
                    : `order-${item.orderId}`;
                  const amount = getDpAmount(item);
                  const isRemitted = getIsRemitted(item);
                  const paidAt = getPaidAt(item);
                  const eventDate = getEventDate(item);
                  const remittedAt = getRemittedAt(item);
                  const remittedBy = getRemittedBy(item);
                  const isMultiInstallment = (item.installmentCount ?? 1) > 1;
                  const reference = String(
                    item.orderReference || item.orderId,
                  ).replace(/^#/, "");

                  return (
                    <tr
                      key={rowKey}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div
                          onClick={() => onSelectOrder?.(item.orderId)}
                          className={onSelectOrder ? "cursor-pointer group" : ""}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                              {item.customerName}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold px-2 py-0.2 rounded-full ${
                                cash
                                  ? "border-amber-300 bg-amber-50 text-amber-900"
                                  : "border-sky-300 bg-sky-50 text-sky-900"
                              }`}
                            >
                              {cash ? "💵 Cash" : `📱 ${method}`}
                            </Badge>
                            {isMultiInstallment && (
                              <Badge
                                variant="outline"
                                className="border-stone-300 bg-stone-100 text-stone-800 text-[10px] font-bold px-1.5 py-0"
                              >
                                Payment {item.installmentIndex}/{item.installmentCount}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                            <span className="font-mono font-bold text-amber-900/80 group-hover:underline">
                              #{reference}
                            </span>
                            {isWalkIn(item) && (
                              <Badge className="border border-indigo-200 bg-indigo-50 px-1.5 py-0 text-[10px] text-indigo-800 hover:bg-indigo-50">
                                🚶 Walk-in
                              </Badge>
                            )}
                            {paidAt && (
                              <span className="text-stone-600 font-medium">
                                • Paid {formatDate(paidAt)}
                              </span>
                            )}
                            {item.referenceNumber && (
                              <span className="font-mono text-stone-500">
                                • Ref: {item.referenceNumber}
                              </span>
                            )}
                            <span>
                              • Encoded by{" "}
                              {item.encodedBy
                                ? `@${item.encodedBy.replace(/^@/, "")}`
                                : "Staff"}
                            </span>
                            {item.phoneNumber && (
                              <span>• {item.phoneNumber}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-lg font-black ${
                          cash ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {money(amount)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-800">
                        {formatDate(eventDate)}
                      </td>
                      <td className="px-4 py-3">
                        {isRemitted ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <div>
                              <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 font-semibold">
                                ✅ Remitted to Owner
                              </Badge>
                              <div className="mt-1 text-[11px] text-stone-500">
                                {formatDateTime(remittedAt)}
                                {remittedBy ? ` • by ${remittedBy}` : ""}
                              </div>
                            </div>
                            {isOwner && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] text-stone-500 hover:text-rose-700 cursor-pointer"
                                disabled={toggleRemittance.isPending}
                                onClick={() => handleToggle(item)}
                              >
                                Undo
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge className="border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 font-semibold">
                              ⏳ Unremitted
                            </Badge>
                            {isOwner && (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer shadow-2xs"
                                disabled={toggleRemittance.isPending}
                                onClick={() => handleToggle(item)}
                              >
                                ✓ Mark Remitted
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Progressive Pagination Controls */}
        {filteredItems.length > 30 && (
          <div className="border-t border-stone-200 bg-stone-50/70 p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-600">
            <div>
              Showing{" "}
              <span className="font-bold text-stone-900">
                {visibleItems.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-stone-900">
                {filteredItems.length}
              </span>{" "}
              downpayments
              {filteredItems.length < items.length && (
                <span className="text-stone-400">
                  {" "}
                  (filtered from {items.length} total)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {visibleCount < filteredItems.length && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold border-stone-300 bg-white text-stone-800 hover:bg-stone-100 cursor-pointer"
                    onClick={() =>
                      setVisibleCount((prev) =>
                        Math.min(prev + 30, filteredItems.length),
                      )
                    }
                  >
                    Show 30 More ({visibleItems.length} of {filteredItems.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs font-semibold text-amber-900 hover:bg-amber-50 cursor-pointer"
                    onClick={() => setVisibleCount(filteredItems.length)}
                  >
                    Show All
                  </Button>
                </>
              )}
              {visibleCount >= filteredItems.length &&
                filteredItems.length > 30 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
                    onClick={() => setVisibleCount(30)}
                  >
                    Show First 30
                  </Button>
                )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
