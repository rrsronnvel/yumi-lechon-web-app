import { useMemo, useState } from "react";
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
    maximumFractionDigits: 2,
  })}`;

const isCashMethod = (method?: string | null) =>
  (method || "").trim().toLowerCase() === "cash";

const isDigitalMethod = (method?: string | null) => {
  const normalized = (method || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");
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
  const toggleRemittance = useToggleDownpaymentRemittanceMutation();

  const summary = useMemo(
    () =>
      items.reduce(
        (totals, item) => {
          const amount = Number(item.downpaymentAmount || 0);
          if (item.isDpRemittedToOwner) {
            totals.verified += amount;
          } else if (isCashMethod(item.downpaymentMethod)) {
            totals.unremittedCash += amount;
            totals.unremittedCashCount += 1;
            totals.unremittedCount += 1;
          } else if (isDigitalMethod(item.downpaymentMethod)) {
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
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.startsWith("#") ? q.slice(1) : q;

    return items.filter((item) => {
      // 1. Text Search Filter across customerName, orderReference, orderId, phoneNumber, downpaymentMethod, bookingSource, encodedBy
      if (cleanQ) {
        const matchCustomer = item.customerName?.toLowerCase().includes(cleanQ);
        const matchRef = item.orderReference?.toLowerCase().includes(cleanQ);
        const matchId = String(item.orderId).includes(cleanQ);
        const matchPhone = item.phoneNumber?.toLowerCase().includes(cleanQ);
        const matchMethod = item.downpaymentMethod?.toLowerCase().includes(cleanQ);
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
          return isCashMethod(item.downpaymentMethod);
        case "digital":
          return isDigitalMethod(item.downpaymentMethod);
        case "walkin":
          return isWalkIn(item);
        case "unremitted":
          return !item.isDpRemittedToOwner;
        case "remitted":
          return item.isDpRemittedToOwner;
        default:
          return true;
      }
    });
  }, [filter, items, searchQuery]);

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
    toggleRemittance.mutate(item.orderId, {
      onSuccess: () =>
        toast.success(
          item.isDpRemittedToOwner
            ? `Order #${item.orderReference} returned to Unremitted.`
            : `Order #${item.orderReference} DP marked as remitted to Owner!`,
        ),
      onError: () => toast.error("Could not update the DP remittance status."),
    });
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
        </div>
        <div className="rounded-xl border border-sky-300 bg-sky-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-sky-900">
            ⏳ Unverified Digital DP
          </div>
          <div className="mt-1 font-mono text-2xl font-black text-sky-950">
            {money(summary.unverifiedDigital)}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-900">
            ✅ Verified / Remitted DPs
          </div>
          <div className="mt-1 font-mono text-2xl font-black text-emerald-950">
            {money(summary.verified)}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filter === option.value ? "default" : "outline"}
                onClick={() => setFilter(option.value)}
                className={
                  filter === option.value
                    ? "h-8 bg-stone-900 text-xs text-white hover:bg-stone-800 font-bold"
                    : "h-8 border-stone-300 bg-white text-xs text-stone-700"
                }
              >
                {option.label}
              </Button>
            ))}
          </div>

          {searchQuery.trim() && (
            <Badge variant="outline" className="text-[11px] font-normal text-stone-600 bg-white shrink-0 self-start sm:self-center">
              Showing {filteredItems.length} of {items.length} records
            </Badge>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-100/80 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                <th className="px-4 py-3">Customer &amp; Mode</th>
                <th className="px-4 py-3 text-right">DP Amount</th>
                <th className="px-4 py-3">Event Date</th>
                <th className="px-4 py-3">Owner Verification / Remittance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-stone-500">
                    Loading downpayments…
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-stone-500">
                    {searchQuery.trim() ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="w-6 h-6 text-stone-400" />
                        <p className="text-sm font-medium text-stone-700">
                          No downpayments matching &quot;{searchQuery}&quot;
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
                    ) : (
                      "No downpayments match this filter."
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const cash = isCashMethod(item.downpaymentMethod);
                  const reference = String(item.orderReference || item.orderId).replace(
                    /^#/,
                    "",
                  );
                  return (
                    <tr key={item.orderId} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div
                          onClick={() => onSelectOrder?.(item.orderId)}
                          className={onSelectOrder ? "cursor-pointer group" : ""}
                        >
                          <div className="font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                            {item.customerName} - {(item.downpaymentMethod || "Unknown").toLowerCase()}
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
                            <span>
                              Encoded by {item.encodedBy ? `@${item.encodedBy.replace(/^@/, "")}` : "Staff"}
                            </span>
                            {item.phoneNumber && <span>• {item.phoneNumber}</span>}
                          </div>
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-lg font-black ${
                          cash ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {money(item.downpaymentAmount)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-800">
                        {formatDate(item.targetDeliveryTime)}
                      </td>
                      <td className="px-4 py-3">
                        {item.isDpRemittedToOwner ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <div>
                              <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 font-semibold">
                                ✅ Remitted to Owner
                              </Badge>
                              <div className="mt-1 text-[11px] text-stone-500">
                                {formatDateTime(item.dpRemittedAt)}
                                {item.dpRemittedBy
                                  ? ` • by ${item.dpRemittedBy}`
                                  : ""}
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
      </Card>
    </div>
  );
}
