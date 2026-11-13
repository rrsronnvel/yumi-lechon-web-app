import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Calculator,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ExpensePaymentMethod,
  ExpenseRecordDto,
  ExpenseUpsertRequest,
  useAutoReclassifyExpenses,
  useCreateExpense,
  useDeleteExpense,
  useExpenseRecords,
  useExpenseSummary,
  useUpdateExpense,
} from "@/hooks/useExpenses";
import {
  CATEGORY_COST_TYPES,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  ExpenseCostType,
  categorizeExpense,
} from "@/utils/expenseCategorizer";

const PAYMENT_METHODS: ExpensePaymentMethod[] = ["Cash", "GCash", "Maya", "Bank Transfer"];

const CATEGORY_COLORS: Record<ExpenseCostType, string> = {
  COGS: "#d97706",
  OPEX: "#2563eb",
  NON_OP: "#7c3aed",
};

type EntryDraft = {
  expenseDate: string;
  itemDescription: string;
  category: ExpenseCategory;
  quantity: string;
  unit: string;
  unitCost: string;
  totalCost: string;
  paymentMethod: ExpensePaymentMethod;
  remarks: string;
};

const firstDateOfMonth = (monthKey: string) => `${monthKey}-01`;

const makeBlankDraft = (monthKey: string): EntryDraft => ({
  expenseDate: firstDateOfMonth(monthKey),
  itemDescription: "",
  category: "Others",
  quantity: "",
  unit: "",
  unitCost: "",
  totalCost: "",
  paymentMethod: "Cash",
  remarks: "",
});

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const percent = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

const dateOnly = (value: string) => value.slice(0, 10);

const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
};

const draftToPayload = (draft: EntryDraft): ExpenseUpsertRequest => ({
  expenseDate: draft.expenseDate,
  category: draft.category,
  itemDescription: draft.itemDescription.trim(),
  quantity: draft.quantity === "" ? null : Number(draft.quantity),
  unit: draft.unit.trim() || null,
  unitCost: draft.unitCost === "" ? null : Number(draft.unitCost),
  totalCost: Number(draft.totalCost),
  paymentMethod: draft.paymentMethod,
  remarks: draft.remarks.trim() || null,
});

const recordToDraft = (record: ExpenseRecordDto): EntryDraft => ({
  expenseDate: dateOnly(record.expenseDate),
  itemDescription: record.itemDescription,
  category: record.category,
  quantity: record.quantity == null ? "" : String(record.quantity),
  unit: record.unit ?? "",
  unitCost: record.unitCost == null ? "" : String(record.unitCost),
  totalCost: String(record.totalCost),
  paymentMethod: record.paymentMethod,
  remarks: record.remarks ?? "",
});

interface ExpensesPageProps {
  embedded?: boolean;
  showLedger?: boolean;
}

export default function ExpensesPage({ embedded = false, showLedger }: ExpensesPageProps = {}) {
  const { user } = useAuth();
  const isOwner = user?.role === "Owner";
  const ledgerVisible = showLedger ?? !embedded;
  const [monthKey, setMonthKey] = useState("2026-11");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "All">("All");
  const [costTypeFilter, setCostTypeFilter] = useState<ExpenseCostType | "All">("All");
  const [paymentFilter, setPaymentFilter] = useState<ExpensePaymentMethod | "All">("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<EntryDraft>(() => makeBlankDraft("2026-11"));
  const [categoryWasOverridden, setCategoryWasOverridden] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EntryDraft | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  const [year, month] = monthKey.split("-").map(Number);
  const filters = useMemo(
    () => ({
      year,
      month,
      category: categoryFilter,
      costType: costTypeFilter,
      paymentMethod: paymentFilter,
      search,
    }),
    [year, month, categoryFilter, costTypeFilter, paymentFilter, search],
  );

  const recordsQuery = useExpenseRecords(filters, ledgerVisible);
  const summaryQuery = useExpenseSummary(year, month);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const autoReclassify = useAutoReclassifyExpenses();

  useEffect(() => {
    setDraft((current) => ({ ...current, expenseDate: firstDateOfMonth(monthKey) }));
    setEditingId(null);
    setEditDraft(null);
  }, [monthKey]);

  const records = recordsQuery.data ?? [];
  const summary = summaryQuery.data;
  const detectedCategory = categorizeExpense(draft.itemDescription);
  const displayedGrandTotal = summary?.grandTotalOutflow ?? 0;

  const categoryRows = useMemo(() => {
    const byCategory = new Map(
      (summary?.categoryBreakdown ?? []).map((row) => [row.category, row]),
    );
    return EXPENSE_CATEGORIES.map((category) => {
      const found = byCategory.get(category);
      const totalCost = Number(found?.totalCost ?? 0);
      return {
        category,
        costType: CATEGORY_COST_TYPES[category],
        totalCost,
        percentageShare:
          found?.percentageShare ?? (displayedGrandTotal > 0 ? (totalCost / displayedGrandTotal) * 100 : 0),
      };
    });
  }, [summary?.categoryBreakdown, displayedGrandTotal]);

  const chartRows = categoryRows.filter((row) => row.totalCost > 0);
  const netFoodRevenue = summary?.netFoodRevenue ?? 0;
  const grossProfit = summary?.grossProfit ?? 0;
  const operatingNetProfit = summary?.operatingNetProfit ?? 0;
  const grossMargin = netFoodRevenue > 0 ? (grossProfit / netFoodRevenue) * 100 : 0;
  const operatingMargin = netFoodRevenue > 0 ? (operatingNetProfit / netFoodRevenue) * 100 : 0;

  const setDescription = (value: string) => {
    const autoCategory = categorizeExpense(value);
    setDraft((current) => ({
      ...current,
      itemDescription: value,
      category: !categoryWasOverridden && autoCategory ? autoCategory : current.category,
    }));
  };

  const applyPreset = (
    category: ExpenseCategory,
    itemDescription: string,
    unit: string,
    focus: "quantity" | "description",
  ) => {
    setDraft((current) => ({ ...current, category, itemDescription, unit }));
    setCategoryWasOverridden(true);
    window.setTimeout(() => {
      if (focus === "quantity") quantityRef.current?.focus();
      else descriptionRef.current?.focus();
    }, 0);
  };

  const submitExpense = async (event: FormEvent) => {
    event.preventDefault();
    const payload = draftToPayload(draft);
    if (!payload.itemDescription) {
      toast.error("Item / Description is required.");
      descriptionRef.current?.focus();
      return;
    }
    if (!payload.expenseDate || !Number.isFinite(payload.totalCost) || payload.totalCost <= 0) {
      toast.error("Enter a valid date and a Total Cost greater than zero.");
      return;
    }
    if (payload.quantity != null && (!Number.isFinite(payload.quantity) || payload.quantity <= 0)) {
      toast.error("Quantity must be greater than zero when provided.");
      return;
    }

    try {
      await createExpense.mutateAsync(payload);
      toast.success(`${payload.itemDescription} added to the expense ledger.`);
      setDraft(makeBlankDraft(monthKey));
      setCategoryWasOverridden(false);
      descriptionRef.current?.focus();
    } catch {
      toast.error("Expense could not be saved. Check the entry and try again.");
    }
  };

  const saveEdit = async (id: number) => {
    if (!editDraft) return;
    const payload = draftToPayload(editDraft);
    if (!payload.itemDescription || !Number.isFinite(payload.totalCost) || payload.totalCost <= 0) {
      toast.error("Description and a Total Cost greater than zero are required.");
      return;
    }
    try {
      await updateExpense.mutateAsync({ id, payload });
      toast.success("Expense row updated.");
      setEditingId(null);
      setEditDraft(null);
    } catch {
      toast.error("Expense row could not be updated.");
    }
  };

  const removeExpense = async (record: ExpenseRecordDto) => {
    if (!window.confirm(`Delete “${record.itemDescription}” (${money(record.totalCost)})?`)) return;
    try {
      await deleteExpense.mutateAsync(record.id);
      toast.success("Expense removed from the ledger.");
    } catch {
      toast.error("Expense could not be deleted.");
    }
  };

  const runAutoReclassify = async () => {
    try {
      const result = await autoReclassify.mutateAsync({ year, month });
      toast.success(
        result.updatedCount > 0
          ? `${result.updatedCount} of ${result.inspectedCount} rows were reclassified.`
          : `All ${result.inspectedCount} rows already use the correct categories.`,
      );
    } catch {
      toast.error("Categories could not be auto-fixed.");
    }
  };

  return (
    <div className={`${embedded ? "space-y-5" : "mx-auto max-w-[1600px] space-y-6"}`}>
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <ReceiptText className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">
              {embedded ? "Report 2 · Owner financial workspace" : "Expense control workspace"}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-950">
            {embedded ? "Expense & Net Profit Report" : "Expenses Ledger"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {isOwner
              ? "Audit direct costs, overhead, owner outflows, and their impact on operating profit."
              : "Encode and audit store expenses. Sales and profit information is isolated from this account."}
          </p>
        </div>
        <label className="w-full space-y-1 text-xs font-bold text-stone-700 sm:w-56">
          <span>Accounting month</span>
          <Input
            type="month"
            value={monthKey}
            onChange={(event) => setMonthKey(event.target.value || "2026-11")}
            className="bg-white font-mono"
          />
        </label>
      </header>

      {summaryQuery.isLoading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading {monthLabel(monthKey)} expense summary…
        </div>
      ) : summaryQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">
          Expense summary could not be loaded. Confirm the API is running and this account has Owner or Accountant access.
        </div>
      ) : (
        <>
          <section aria-label="Expense totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label={`Total Expenses YTD (${year})`}
              value={money(summary?.totalExpensesYtd)}
              detail="Operating + non-operating outflows"
              accent="stone"
            />
            <MetricCard
              label="Total Direct Costs (COGS - Month)"
              value={money(summary?.totalDirectCosts)}
              detail="Meat, ingredients/freebies, packaging"
              accent="amber"
            />
            <MetricCard
              label="Total Overhead (OPEX - Month)"
              value={money(summary?.totalOverhead)}
              detail="Nine operating overhead categories"
              accent="blue"
            />
            <MetricCard
              label="Total Operating Expenses"
              value={money(summary?.totalOperatingExpenses)}
              detail="COGS + OPEX"
              accent="rose"
            />
            <MetricCard
              label="Owner / Non-Operating Outflows"
              value={money(summary?.ownerNonOperatingOutflows)}
              detail="Excluded from operating net profit"
              accent="violet"
            />
          </section>

          {isOwner && (
            <section
              aria-label="Owner-only revenue and net profit executive summary"
              className="overflow-hidden rounded-xl border border-emerald-800/20 bg-stone-950 text-white shadow-sm"
            >
              <div className="border-b border-white/10 px-5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                  Owner only · Revenue & Net Profit Executive Summary
                </p>
              </div>
              <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                <OwnerMetric label="Net Food Revenue" value={money(netFoodRevenue)} note="Gross sales − discounts − rider fees" />
                <OwnerMetric
                  label="Gross Profit"
                  value={money(summary?.grossProfit)}
                  note={`Net food revenue − COGS · ${percent(grossMargin)} gross margin`}
                />
                <OwnerMetric
                  label="Operating Net Profit"
                  value={money(summary?.operatingNetProfit)}
                  note={`After COGS + OPEX · ${percent(operatingMargin)} operating margin`}
                />
                <OwnerMetric
                  label="Net Cash Flow (After Owner Outflows)"
                  value={money(summary?.netCashFlowAfterOwnerOutflows)}
                  note="Operating net profit − non-operating outflows"
                />
              </div>
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <Card className="overflow-hidden border-stone-200 bg-white shadow-sm">
              <CardHeader className="border-b border-stone-100 pb-4">
                <CardTitle className="text-base">Expense Breakdown by Category</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-stone-100 text-[11px] uppercase tracking-wider text-stone-600">
                      <tr>
                        <th className="px-4 py-3">Category Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Total Cost</th>
                        <th className="px-4 py-3 text-right">% Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {categoryRows.map((row) => (
                        <tr key={row.category} className="hover:bg-amber-50/30">
                          <td className="px-4 py-2.5 font-medium text-stone-800">{row.category}</td>
                          <td className="px-4 py-2.5"><CostTypeBadge type={row.costType} /></td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{money(row.totalCost)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-stone-500">{percent(row.percentageShare)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-stone-300 bg-stone-50 font-bold">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-stone-700">Total Operating Expenses</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{money(summary?.totalOperatingExpenses)}</td>
                        <td className="px-4 py-3" />
                      </tr>
                      <tr className="bg-stone-900 text-white">
                        <td colSpan={2} className="px-4 py-3">Grand Total Outflow</td>
                        <td className="px-4 py-3 text-right font-mono text-base tabular-nums">{money(summary?.grandTotalOutflow)}</td>
                        <td className="px-4 py-3 text-right font-mono">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expense Distribution</CardTitle>
                <p className="text-xs text-stone-500">All operating and non-operating outflows for {monthLabel(monthKey)}</p>
              </CardHeader>
              <CardContent>
                {chartRows.length === 0 ? (
                  <div className="flex h-80 items-center justify-center text-sm text-stone-400">No expenses in this month.</div>
                ) : (
                  <div className="h-[370px] w-full" aria-label="Expense distribution bar chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRows} layout="vertical" margin={{ left: 12, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
                        <XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="category"
                          width={128}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value: string) => value.length > 19 ? `${value.slice(0, 18)}…` : value}
                        />
                        <Tooltip formatter={(value) => money(Number(value))} />
                        <Bar dataKey="totalCost" radius={[0, 5, 5, 0]}>
                          {chartRows.map((row) => <Cell key={row.category} fill={CATEGORY_COLORS[row.costType]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                  <ChartLegend color={CATEGORY_COLORS.COGS} label="COGS" />
                  <ChartLegend color={CATEGORY_COLORS.OPEX} label="OPEX" />
                  <ChartLegend color={CATEGORY_COLORS.NON_OP} label="NON_OP" />
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {ledgerVisible && (
        <section className="space-y-4" aria-label="Daily Expense Tracking Ledger">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-stone-950">Daily Expense Tracking Ledger</h2>
              <p className="text-xs text-stone-500">Quick-entry presets and keyboard-friendly spreadsheet encoding.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={runAutoReclassify}
              disabled={autoReclassify.isPending}
              className="gap-2 border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
            >
              {autoReclassify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              🪄 Auto-Fix Misclassified Categories
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <PresetButton onClick={() => applyPreset("Meat / Main Products", "Live Pigs (Buong Baboy)", "heads", "quantity")}>
              🐷 + Live Pigs (Katay Batch)
            </PresetButton>
            <PresetButton onClick={() => applyPreset("Packaging", "", "pcs", "description")}>
              📦 + Packaging (Bilao / Belly Box)
            </PresetButton>
            <PresetButton onClick={() => applyPreset("Ingredients & Freebies", "", "", "description")}>
              🛒 + Market / Freebies Run
            </PresetButton>
            <PresetButton onClick={() => applyPreset("Owner / Non-Operating Outflow", "", "", "description")}>
              👑 + Owner / Non-Op Outflow
            </PresetButton>
          </div>

          <Card className="overflow-hidden border-amber-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-amber-700" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-950">Grand Total · {monthLabel(monthKey)}</span>
              </div>
              <span className="font-mono text-xl font-black tabular-nums text-stone-950">{money(summary?.grandTotalOutflow)}</span>
            </div>

            <form onSubmit={submitExpense} className="border-b border-stone-200 bg-stone-50 p-3 overflow-x-auto">
              <div className="grid gap-2 min-w-[1080px] grid-cols-[132px_minmax(200px,1.6fr)_minmax(190px,1.3fr)_85px_85px_130px_130px_minmax(160px,1fr)_140px]">
                <FieldLabel label="Date">
                  <Input
                    type="date"
                    required
                    value={draft.expenseDate}
                    onChange={(event) => setDraft({ ...draft, expenseDate: event.target.value })}
                    className="h-9 bg-white px-2 text-xs"
                  />
                </FieldLabel>

                <FieldLabel
                  label="Item / Description"
                  rightBadge={
                    detectedCategory ? (
                      <span className={`inline-flex shrink-0 rounded-full px-1.5 py-0 text-[8px] font-bold ${categoryWasOverridden ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-800"}`}>
                        {categoryWasOverridden ? "Manual · " : "Auto · "}{draft.category}
                      </span>
                    ) : null
                  }
                >
                  <Input
                    ref={descriptionRef}
                    required
                    placeholder="Start typing, e.g. Lechon Belly Box"
                    value={draft.itemDescription}
                    onChange={(event) => setDescription(event.target.value)}
                    className="h-9 bg-white px-2 text-xs"
                  />
                </FieldLabel>

                <FieldLabel
                  label="Category"
                  rightBadge={<CostTypeBadge type={CATEGORY_COST_TYPES[draft.category]} />}
                >
                  <select
                    value={draft.category}
                    onChange={(event) => {
                      setDraft({ ...draft, category: event.target.value as ExpenseCategory });
                      setCategoryWasOverridden(true);
                    }}
                    className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-xs"
                  >
                    {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </FieldLabel>

                <FieldLabel label="Qty">
                  <Input
                    ref={quantityRef}
                    type="number"
                    min="0.01"
                    step="any"
                    value={draft.quantity}
                    onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
                    className="h-9 bg-white px-2 text-xs"
                  />
                </FieldLabel>

                <FieldLabel label="Unit">
                  <Input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="pcs" className="h-9 bg-white px-2 text-xs" />
                </FieldLabel>

                <FieldLabel
                  label="Total Cost (₱)"
                  rightBadge={
                    Number(draft.quantity) > 0 && Number(draft.totalCost) > 0 ? (
                      <span className="shrink-0 font-mono text-[9px] text-stone-500">
                        {money(Number(draft.totalCost) / Number(draft.quantity))}/u
                      </span>
                    ) : null
                  }
                >
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={draft.totalCost}
                    onChange={(event) => setDraft({ ...draft, totalCost: event.target.value })}
                    className="h-9 bg-white px-2 font-mono text-xs"
                  />
                </FieldLabel>

                <FieldLabel label="Payment Method">
                  <select value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value as ExpensePaymentMethod })} className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-xs">
                    {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
                  </select>
                </FieldLabel>

                <FieldLabel label="Remarks">
                  <Input value={draft.remarks} onChange={(event) => setDraft({ ...draft, remarks: event.target.value })} placeholder="Vendor / source" className="h-9 bg-white px-2 text-xs" />
                </FieldLabel>

                <div className="flex flex-col gap-1">
                  <div className="h-4" />
                  <Button type="submit" disabled={createExpense.isPending} className="h-9 w-full gap-1.5 bg-[#C81E1E] text-xs font-bold text-white hover:bg-[#A81818] shadow-2xs">
                    {createExpense.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add Expense
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-stone-500">Press Enter anywhere in the row to save immediately. Category changes are preserved as manual overrides.</p>
            </form>

            <div className="grid gap-2 border-b border-stone-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, vendor, encoder…" className="h-9 text-xs" />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ExpenseCategory | "All")} className="h-9 rounded-md border border-stone-200 bg-white px-2 text-xs">
                <option value="All">All Categories</option>
                {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
              <select value={costTypeFilter} onChange={(event) => setCostTypeFilter(event.target.value as ExpenseCostType | "All")} className="h-9 rounded-md border border-stone-200 bg-white px-2 text-xs">
                <option value="All">All Cost Types</option>
                <option value="COGS">COGS</option>
                <option value="OPEX">OPEX</option>
                <option value="NON_OP">NON_OP</option>
              </select>
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as ExpensePaymentMethod | "All")} className="h-9 rounded-md border border-stone-200 bg-white px-2 text-xs">
                <option value="All">All Payment Methods</option>
                {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method === "Bank Transfer" ? "Bank" : method}</option>)}
              </select>
              <Button type="button" variant="outline" onClick={() => { setSearch(""); setCategoryFilter("All"); setCostTypeFilter("All"); setPaymentFilter("All"); }} className="h-9 text-xs">
                Clear Filters
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] text-left text-xs">
                <thead className="border-b border-stone-200 bg-stone-100 text-[10px] uppercase tracking-wider text-stone-600">
                  <tr>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Item / Description</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3">Unit</th>
                    <th className="px-3 py-3 text-right">Unit Cost</th>
                    <th className="px-3 py-3 text-right">Total Cost</th>
                    <th className="px-3 py-3">Payment</th>
                    <th className="px-3 py-3">Remarks / Encoder</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recordsQuery.isLoading ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-stone-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading ledger…</td></tr>
                  ) : recordsQuery.isError ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center font-medium text-rose-700">The expense ledger could not be loaded.</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-stone-500">No expense rows match these filters.</td></tr>
                  ) : records.map((record) => editingId === record.id && editDraft ? (
                    <EditExpenseRow
                      key={record.id}
                      draft={editDraft}
                      setDraft={setEditDraft}
                      saving={updateExpense.isPending}
                      onSave={() => saveEdit(record.id)}
                      onCancel={() => { setEditingId(null); setEditDraft(null); }}
                    />
                  ) : (
                    <tr key={record.id} className="hover:bg-amber-50/30">
                      <td className="px-3 py-3 font-mono text-stone-600">{dateOnly(record.expenseDate)}</td>
                      <td className="px-3 py-3 font-semibold text-stone-900">{record.itemDescription}</td>
                      <td className="px-3 py-3"><div className="space-y-1"><span>{record.category}</span><br /><CostTypeBadge type={record.costType} /></div></td>
                      <td className="px-3 py-3 text-right font-mono">{record.quantity ?? "—"}</td>
                      <td className="px-3 py-3 text-stone-600">{record.unit ?? "—"}</td>
                      <td className="px-3 py-3 text-right font-mono text-stone-600">{record.computedUnitCost == null ? "—" : money(record.computedUnitCost)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">{money(record.totalCost)}</td>
                      <td className="px-3 py-3"><Badge variant="outline" className="text-[10px]">{record.paymentMethod}</Badge></td>
                      <td className="px-3 py-3"><p className="text-stone-700">{record.remarks || "—"}</p><p className="mt-0.5 text-[9px] text-stone-400">Encoded by {record.encodedBy}</p></td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="outline" size="icon" aria-label={`Edit ${record.itemDescription}`} onClick={() => { setEditingId(record.id); setEditDraft(recordToDraft(record)); }} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button type="button" variant="outline" size="icon" aria-label={`Delete ${record.itemDescription}`} onClick={() => removeExpense(record)} disabled={deleteExpense.isPending} className="h-8 w-8 border-rose-200 text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: "stone" | "amber" | "blue" | "rose" | "violet" }) {
  const colors = {
    stone: "border-t-stone-700",
    amber: "border-t-amber-500",
    blue: "border-t-blue-600",
    rose: "border-t-rose-600",
    violet: "border-t-violet-600",
  };
  return (
    <Card className={`border-stone-200 border-t-4 bg-white shadow-sm ${colors[accent]}`}>
      <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase leading-4 tracking-wider text-stone-500">{label}</CardTitle></CardHeader>
      <CardContent><p className="font-mono text-xl font-black tabular-nums text-stone-950">{value}</p><p className="mt-1 text-[10px] leading-4 text-stone-500">{detail}</p></CardContent>
    </Card>
  );
}

function OwnerMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p><p className="mt-2 font-mono text-xl font-black tabular-nums text-white">{value}</p><p className="mt-1 text-[10px] leading-4 text-emerald-200/80">{note}</p></div>;
}

function CostTypeBadge({ type }: { type: ExpenseCostType }) {
  const style = type === "COGS" ? "bg-amber-100 text-amber-800" : type === "OPEX" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider ${style}`}>{type}</span>;
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2 py-1 text-stone-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function PresetButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-xs transition-colors hover:border-amber-300 hover:bg-amber-50">{children}</button>;
}

function FieldLabel({
  label,
  children,
  rightBadge,
}: {
  label: string;
  children: React.ReactNode;
  rightBadge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-4 items-center justify-between gap-1">
        <span className="block truncate text-[9px] font-bold uppercase tracking-wider text-stone-500">
          {label}
        </span>
        {rightBadge}
      </div>
      {children}
    </div>
  );
}

function EditExpenseRow({ draft, setDraft, saving, onSave, onCancel }: { draft: EntryDraft; setDraft: (draft: EntryDraft) => void; saving: boolean; onSave: () => void; onCancel: () => void }) {
  const [categoryWasOverridden, setCategoryWasOverridden] = useState(false);
  return (
    <tr className="bg-amber-50/70 align-top">
      <td className="p-2"><Input type="date" value={draft.expenseDate} onChange={(event) => setDraft({ ...draft, expenseDate: event.target.value })} className="h-8 w-32 px-1 text-[10px]" /></td>
      <td className="p-2"><Input value={draft.itemDescription} onChange={(event) => { const value = event.target.value; const category = categorizeExpense(value); setDraft({ ...draft, itemDescription: value, category: !categoryWasOverridden && category ? category : draft.category }); }} className="h-8 min-w-44 px-2 text-xs" /></td>
      <td className="p-2"><select value={draft.category} onChange={(event) => { setDraft({ ...draft, category: event.target.value as ExpenseCategory }); setCategoryWasOverridden(true); }} className="h-8 w-48 rounded-md border border-stone-200 bg-white px-1 text-[10px]">{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></td>
      <td className="p-2"><Input type="number" min="0.01" step="any" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} className="h-8 w-20 px-1 text-right text-xs" /></td>
      <td className="p-2"><Input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} className="h-8 w-20 px-1 text-xs" /></td>
      <td className="p-2 text-right font-mono text-stone-500">{Number(draft.quantity) > 0 && Number(draft.totalCost) > 0 ? money(Number(draft.totalCost) / Number(draft.quantity)) : "—"}</td>
      <td className="p-2"><Input type="number" min="0.01" step="0.01" value={draft.totalCost} onChange={(event) => setDraft({ ...draft, totalCost: event.target.value })} className="h-8 w-28 px-1 text-right font-mono text-xs" /></td>
      <td className="p-2"><select value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value as ExpensePaymentMethod })} className="h-8 w-28 rounded-md border border-stone-200 bg-white px-1 text-[10px]">{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></td>
      <td className="p-2"><Input value={draft.remarks} onChange={(event) => setDraft({ ...draft, remarks: event.target.value })} className="h-8 min-w-36 px-2 text-xs" /></td>
      <td className="p-2"><div className="flex justify-end gap-1"><Button type="button" size="icon" onClick={onSave} disabled={saving} aria-label="Save expense changes" className="h-8 w-8 bg-emerald-700 hover:bg-emerald-800">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}</Button><Button type="button" size="icon" variant="outline" onClick={onCancel} aria-label="Cancel editing" className="h-8 w-8"><X className="h-3.5 w-3.5" /></Button></div></td>
    </tr>
  );
}
