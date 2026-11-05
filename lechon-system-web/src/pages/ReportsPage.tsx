import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Loader2 } from "lucide-react";
import apiClient from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReportTab = "summary" | "admins" | "payments";
type Preset = "Today" | "This Week" | "This Month" | "Last Month" | "Custom Range";

interface ReportsAnalytics {
  startDate: string;
  endDate: string;
  preset: string;
  orderSummary: {
    totalOrders: number;
    confirmedOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalGrossRevenue: number;
    averageOrderValue: number;
    lechonSizes: { size: string; count: number; revenue: number }[];
  };
  adminPerformance: {
    adminName: string;
    totalOrdersAssisted: number;
    totalSalesGenerated: number;
    completedOrdersCount: number;
  }[];
  paymentCollection: {
    totalGrossSales: number;
    totalDownpaymentCollected: number;
    totalCollectedAtHandover: number;
    totalCollected: number;
    totalOutstandingBalance: number;
    paymentChannels: {
      cash: number;
      gCash: number;
      maya: number;
      bankTransfer: number;
    };
  };
}

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const presetRange = (preset: Preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = new Date(today);
  let end = new Date(today);

  if (preset === "This Week") {
    const daysSinceMonday = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - daysSinceMonday);
    end.setDate(start.getDate() + 6);
  } else if (preset === "This Month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (preset === "Last Month") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  }

  return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
};

const csvCell = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

export default function ReportsPage() {
  const initialRange = useMemo(() => presetRange("This Month"), []);
  const [preset, setPreset] = useState<Preset>("This Month");
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");

  const { data, isLoading, isError } = useQuery<ReportsAnalytics>({
    queryKey: ["reports", "analytics", startDate, endDate, preset],
    queryFn: async () => {
      const response = await apiClient.get<ReportsAnalytics>("/reports/analytics", {
        params: { startDate, endDate, preset },
      });
      return response.data;
    },
    enabled: Boolean(startDate && endDate),
  });

  const applyPreset = (nextPreset: Preset) => {
    setPreset(nextPreset);
    if (nextPreset !== "Custom Range") {
      const range = presetRange(nextPreset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const updateCustomDate = (field: "start" | "end", value: string) => {
    setPreset("Custom Range");
    if (field === "start") setStartDate(value);
    else setEndDate(value);
  };

  const exportCsv = () => {
    if (!data) return;
    let rows: Array<Array<string | number>> = [];
    if (activeTab === "summary") {
      rows = [
        ["Order Summary Report", `${startDate} to ${endDate}`],
        ["Total Orders", data.orderSummary.totalOrders],
        ["Confirmed Orders", data.orderSummary.confirmedOrders],
        ["Completed Orders", data.orderSummary.completedOrders],
        ["Cancelled Orders", data.orderSummary.cancelledOrders],
        ["Total Gross Revenue", data.orderSummary.totalGrossRevenue],
        ["Average Order Value", data.orderSummary.averageOrderValue],
        [],
        ["Lechon Size", "Count", "Revenue"],
        ...data.orderSummary.lechonSizes.map((row) => [row.size, row.count, row.revenue]),
      ];
    } else if (activeTab === "admins") {
      rows = [
        ["Admin Performance Report", `${startDate} to ${endDate}`],
        ["Admin Name", "Orders Assisted", "Total Sales", "Completed / Commission-Ready"],
        ...data.adminPerformance.map((row) => [
          row.adminName,
          row.totalOrdersAssisted,
          row.totalSalesGenerated,
          row.completedOrdersCount,
        ]),
      ];
    } else {
      const payment = data.paymentCollection;
      rows = [
        ["Payment & Collection Report", `${startDate} to ${endDate}`],
        ["Total Gross Sales", payment.totalGrossSales],
        ["Total Downpayment Collected", payment.totalDownpaymentCollected],
        ["Total Collected at Handover", payment.totalCollectedAtHandover],
        ["Total Collected", payment.totalCollected],
        ["Total Outstanding Balance", payment.totalOutstandingBalance],
        [],
        ["Payment Channel", "Amount Received"],
        ["Cash", payment.paymentChannels.cash],
        ["GCash", payment.paymentChannels.gCash],
        ["Maya", payment.paymentChannels.maya],
        ["Bank Transfer", payment.paymentChannels.bankTransfer],
      ];
    }

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `yumi-${activeTab}-report-${startDate}-to-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Owner workspace</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-950">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-stone-500">
            Monthly performance, admin-assisted sales, and payment collection audit.
          </p>
        </div>
        <Button
          type="button"
          onClick={exportCsv}
          disabled={!data}
          className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
        >
          <Download className="h-4 w-4" /> 📥 Export CSV
        </Button>
      </div>

      <Card className="border-stone-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {(["Today", "This Week", "This Month", "Last Month", "Custom Range"] as Preset[]).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => applyPreset(item)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    preset === item
                      ? "border-amber-500 bg-amber-500 text-stone-950"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <label className="space-y-1 text-xs font-semibold text-stone-700">
              <span>Start Date</span>
              <Input type="date" value={startDate} onChange={(event) => updateCustomDate("start", event.target.value)} />
            </label>
            <span className="hidden pb-2 text-xs text-stone-400 sm:block">to</span>
            <label className="space-y-1 text-xs font-semibold text-stone-700">
              <span>End Date</span>
              <Input type="date" value={endDate} onChange={(event) => updateCustomDate("end", event.target.value)} />
            </label>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading owner reports…
        </div>
      ) : isError || !data ? (
        <Card className="border-rose-200 bg-rose-50 p-6 text-center text-sm font-medium text-rose-800">
          Reports could not be loaded. Confirm the local API is running and your account has the Owner role.
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)}>
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-stone-100 p-1 sm:grid-cols-3">
            <TabsTrigger value="summary">📋 Order Summary Report</TabsTrigger>
            <TabsTrigger value="admins">👥 Admin Performance Report</TabsTrigger>
            <TabsTrigger value="payments">💳 Payment & Collection Report</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Total Orders" value={data.orderSummary.totalOrders.toLocaleString()} detail={`${data.orderSummary.completedOrders} completed • ${data.orderSummary.cancelledOrders} cancelled`} />
              <KpiCard label="Total Revenue" value={money(data.orderSummary.totalGrossRevenue)} detail="Active, non-cancelled sales" />
              <KpiCard label="Average Order Value" value={money(data.orderSummary.averageOrderValue)} detail={`${data.orderSummary.confirmedOrders} currently confirmed`} />
            </div>
            <ReportTable
              headers={["Lechon Size", "Quantity Sold", "Revenue"]}
              rows={data.orderSummary.lechonSizes.map((row) => [row.size, row.count.toLocaleString(), money(row.revenue)])}
            />
          </TabsContent>

          <TabsContent value="admins" className="mt-5">
            <ReportTable
              headers={["Admin Name", "Orders Assisted", "Total Sales", "Completed / Commission-Ready"]}
              rows={data.adminPerformance.map((row) => [
                row.adminName,
                row.totalOrdersAssisted.toLocaleString(),
                money(row.totalSalesGenerated),
                row.completedOrdersCount.toLocaleString(),
              ])}
              emptyMessage="No active admin-assisted orders in this date range."
            />
          </TabsContent>

          <TabsContent value="payments" className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total Sales" value={money(data.paymentCollection.totalGrossSales)} />
              <KpiCard label="Total Collected" value={money(data.paymentCollection.totalCollected)} detail={`${money(data.paymentCollection.totalDownpaymentCollected)} downpayments`} />
              <KpiCard label="Collected at Handover" value={money(data.paymentCollection.totalCollectedAtHandover)} />
              <KpiCard label="Remaining Balance" value={money(data.paymentCollection.totalOutstandingBalance)} emphasis="rose" />
            </div>
            <ReportTable
              headers={["Payment Channel", "Amount Received"]}
              rows={[
                ["Cash", money(data.paymentCollection.paymentChannels.cash)],
                ["GCash", money(data.paymentCollection.paymentChannels.gCash)],
                ["Maya", money(data.paymentCollection.paymentChannels.maya)],
                ["Bank Transfer", money(data.paymentCollection.paymentChannels.bankTransfer)],
              ]}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  emphasis = "amber",
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: "amber" | "rose";
}) {
  return (
    <Card className="border-stone-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-stone-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-black tabular-nums ${emphasis === "rose" ? "text-rose-700" : "text-stone-950"}`}>{value}</div>
        {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function ReportTable({
  headers,
  rows,
  emptyMessage = "No report rows for this date range.",
}: {
  headers: string[];
  rows: string[][];
  emptyMessage?: string;
}) {
  return (
    <Card className="overflow-hidden border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-100 text-xs uppercase tracking-wider text-stone-600">
            <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-bold">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="px-4 py-10 text-center text-stone-500">{emptyMessage}</td></tr>
            ) : rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="hover:bg-amber-50/40">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className={`px-4 py-3 ${cellIndex > 0 ? "font-mono tabular-nums" : "font-semibold text-stone-900"}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
